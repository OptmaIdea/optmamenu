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
    const safeName = createSafeImageFilename(file.name, 'avatar');
    const filePath = `${userId}/${safeName}`;

    // 2. Upload do novo avatar otimizado
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

        // 4. Limpeza rigorosa de avatares legados/anteriores: apaga TODOS os outros arquivos da pasta do usuário
        try {
            const pathsToRemove = new Set<string>();

            // Adiciona o avatar antigo explicitamente se puder ser extraído da URL
            if (currentAvatarUrl) {
                const oldExtractedPath = extractBucketPathFromUrl(currentAvatarUrl, AVATAR_BUCKET);
                if (oldExtractedPath && oldExtractedPath !== filePath) {
                    pathsToRemove.add(oldExtractedPath);
                }
            }

            // Lista todos os arquivos existentes dentro do diretório do usuário no bucket
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

            const oldPathsArray = Array.from(pathsToRemove);
            if (oldPathsArray.length > 0) {
                const { error: removeErr } = await supabase.storage.from(AVATAR_BUCKET).remove(oldPathsArray);
                if (removeErr) {
                    console.warn('[uploadStoreMemberAvatar] Aviso ao remover avatares antigos:', removeErr);
                }
            }
        } catch (cleanupError) {
            console.warn('[uploadStoreMemberAvatar] Erro no fluxo de limpeza de avatares antigos:', cleanupError);
        }

        return {
            avatarUrl: publicUrl,
            result: Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData,
        };
    } catch (err) {
        // Rollback: se o banco falhar, remove o novo arquivo recém enviado para não deixar lixo
        try {
            await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);
        } catch {
            // Ignora erro no rollback
        }
        throw err;
    }
}
