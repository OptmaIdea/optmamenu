import { supabase } from '@/lib/supabase';
import { optimizeImageForUpload, createSafeImageFilename, IMAGE_PROFILES } from '@/utils/imageOptimization';
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

    // Gera nome único seguro com UUID para permitir INSERT direto via RLS (upsert: false)
    const safeName = createSafeImageFilename(file.name, 'avatar');
    const filePath = `${userId}/${safeName}`;

    // 2. Upload da nova imagem usando INSERT (upsert: false) para respeitar políticas RLS do Supabase
    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, optimized.file, {
            cacheControl: '31536000',
            upsert: false,
            contentType: 'image/webp',
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

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

        // 4. Exclusão dos avatares anteriores do usuário no Storage
        try {
            const pathsToRemove = new Set<string>();

            // Extrai a URL antiga se for uma foto do bucket user-avatars
            if (currentAvatarUrl) {
                const oldExtractedPath = extractBucketPathFromUrl(currentAvatarUrl, AVATAR_BUCKET);
                if (oldExtractedPath && oldExtractedPath !== filePath) {
                    pathsToRemove.add(oldExtractedPath);
                }
            }

            // Tenta listar outros arquivos legados dentro da pasta do usuário para não acumular fotos antigas
            const { data: existingFiles } = await supabase.storage
                .from(AVATAR_BUCKET)
                .list(userId, { limit: 500 });

            if (existingFiles && existingFiles.length > 0) {
                existingFiles.forEach((f) => {
                    if (f.name && f.name !== safeName && f.name !== '.emptyFolderPlaceholder') {
                        pathsToRemove.add(`${userId}/${f.name}`);
                    }
                });
            }

            const legacyPaths = Array.from(pathsToRemove);
            if (legacyPaths.length > 0) {
                await supabase.storage.from(AVATAR_BUCKET).remove(legacyPaths);
            }
        } catch (cleanupError) {
            console.warn('[uploadStoreMemberAvatar] Aviso na remoção de avatares antigos:', cleanupError);
        }

        return {
            avatarUrl: publicUrl,
            result: Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData,
        };
    } catch (err) {
        // Rollback da imagem enviada em caso de falha no banco
        try {
            await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);
        } catch {
            // Ignora erro no rollback
        }
        throw err;
    }
}
