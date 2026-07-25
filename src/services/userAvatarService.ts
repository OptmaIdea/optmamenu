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

    // 1. Otimização da nova imagem para WebP no perfil avatar (512x512)
    const optimized = await optimizeImageForUpload(file, IMAGE_PROFILES.avatar);

    // Estratégia de Arquivo Único Determinístico por funcionário
    // Toda troca de avatar do funcionário substitui (upsert) o arquivo 'avatar.webp' dentro da sua pasta
    const fixedFileName = 'avatar.webp';
    const filePath = `${userId}/${fixedFileName}`;

    // 2. Upload do avatar otimizado com upsert: true para sobrescrever o arquivo existente
    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, optimized.file, {
            cacheControl: '0',
            upsert: true,
            contentType: 'image/webp',
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

    // Adiciona o timestamp para invalidar caches antigos no navegador
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    try {
        // 3. Atualizar a referência do avatar no banco de dados via RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc(
            'update_store_member_avatar_url',
            {
                p_member_id: memberId,
                p_avatar_url: publicUrl,
                p_reason: reason ?? 'Alteração de avatar pela tela de usuário.',
            }
        );

        if (rpcError) {
            throw rpcError;
        }

        // 4. Limpeza de todos os arquivos legados acumulados anteriormente na pasta do usuário
        try {
            const pathsToRemove = new Set<string>();

            // Adiciona URL antiga se for diferente do caminho fixo
            if (currentAvatarUrl) {
                const oldExtractedPath = extractBucketPathFromUrl(currentAvatarUrl, AVATAR_BUCKET);
                if (oldExtractedPath && oldExtractedPath !== filePath) {
                    pathsToRemove.add(oldExtractedPath);
                }
            }

            // Busca arquivos legados na pasta do usuário (ex: avatar-1780448547849.webp, avatar-1780599830501.png)
            const { data: existingFiles } = await supabase.storage
                .from(AVATAR_BUCKET)
                .list(userId, { limit: 500 });

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
        } catch (cleanupError) {
            console.warn('[uploadStoreMemberAvatar] Aviso ao remover avatares legados:', cleanupError);
        }

        return {
            avatarUrl: publicUrl,
            result: Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData,
        };
    } catch (err) {
        throw err;
    }
}
