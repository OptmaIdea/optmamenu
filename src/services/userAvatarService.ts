import { supabase } from '@/lib/supabase';
import { optimizeImageForUpload, IMAGE_PROFILES } from '@/utils/imageOptimization';
import { extractBucketPathFromUrl } from '@/utils/supabaseStorage';

const AVATAR_BUCKET = 'user-avatars';

export async function uploadStoreMemberAvatar(params: {
    memberId: string;
    userId: string;
    file: File;
    currentAvatarUrl?: string | null;
    reason?: string;
}) {
    const { memberId, userId, file, currentAvatarUrl, reason } = params;

    // 1. Otimização da imagem para WebP (perfil 512x512)
    const optimized = await optimizeImageForUpload(file, IMAGE_PROFILES.avatar);

    // 2. Caminho Determinístico Fixo para avatar de usuário
    const fixedFileName = 'avatar.webp';
    const filePath = `${userId}/${fixedFileName}`;

    // 3. Upload determinístico com upsert: true
    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, optimized.file, {
            cacheControl: '31536000',
            upsert: true,
            contentType: 'image/webp',
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

    // Cache busting usando versão por timestamp para atualizar instantaneamente no navegador
    const version = Date.now();
    const versionedUrl = `${data.publicUrl}?v=${version}`;

    try {
        // 4. Persistir a URL no banco de dados via RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc(
            'update_store_member_avatar_url',
            {
                p_member_id: memberId,
                p_avatar_url: versionedUrl,
                p_reason: reason ?? 'Alteração de avatar pela tela de usuário.',
            }
        );

        if (rpcError) {
            throw rpcError;
        }

        // 5. Exclusão de arquivos legados com UUID/timestamp antigos na pasta do usuário
        try {
            const pathsToRemove = new Set<string>();

            if (currentAvatarUrl) {
                const oldPath = extractBucketPathFromUrl(currentAvatarUrl, AVATAR_BUCKET);
                if (oldPath && oldPath !== filePath && oldPath.startsWith(`${userId}/`)) {
                    pathsToRemove.add(oldPath);
                }
            }

            const { data: existingFiles } = await supabase.storage
                .from(AVATAR_BUCKET)
                .list(userId, { limit: 100 });

            if (existingFiles && existingFiles.length > 0) {
                existingFiles.forEach((f) => {
                    if (f.name && f.name !== fixedFileName && f.name !== '.emptyFolderPlaceholder') {
                        pathsToRemove.add(`${userId}/${f.name}`);
                    }
                });
            }

            const legacyPaths = Array.from(pathsToRemove);
            if (legacyPaths.length > 0) {
                await supabase.storage.from(AVATAR_BUCKET).remove(legacyPaths);
            }
        } catch (cleanupErr) {
            console.warn('[uploadStoreMemberAvatar] Limpeza de arquivos legados:', cleanupErr);
        }

        return {
            avatarUrl: versionedUrl,
            result: Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData,
        };
    } catch (err) {
        throw err;
    }
}

/**
 * Remoção explícita da foto de perfil de um funcionário/membro.
 * Deleta o arquivo determinístico no storage e atualiza o banco para null.
 */
export async function deleteStoreMemberAvatar(params: {
    memberId: string;
    userId: string;
    currentAvatarUrl?: string | null;
    reason?: string;
}) {
    const { memberId, userId, currentAvatarUrl, reason } = params;
    const filePath = `${userId}/avatar.webp`;

    const pathsToRemove = new Set<string>([filePath]);

    if (currentAvatarUrl) {
        const oldPath = extractBucketPathFromUrl(currentAvatarUrl, AVATAR_BUCKET);
        if (oldPath) {
            pathsToRemove.add(oldPath);
        }
    }

    // 1. Remover objetos no Storage
    try {
        await supabase.storage.from(AVATAR_BUCKET).remove(Array.from(pathsToRemove));
    } catch (err) {
        console.warn('[deleteStoreMemberAvatar] Aviso na remoção do storage (objeto pode já não existir):', err);
    }

    // 2. Atualizar o banco de dados via RPC para null
    const { data: rpcData, error: rpcError } = await supabase.rpc(
        'update_store_member_avatar_url',
        {
            p_member_id: memberId,
            p_avatar_url: null,
            p_reason: reason ?? 'Remoção explícita de avatar.',
        }
    );

    if (rpcError) {
        throw rpcError;
    }

    return {
        avatarUrl: null,
        result: Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData,
    };
}
