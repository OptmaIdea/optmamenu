import { supabase } from '@/lib/supabase';
import { optimizeImageForUpload, IMAGE_PROFILES } from '@/utils/imageOptimization';
import { extractBucketPathFromUrl } from '@/utils/supabaseStorage';

const AVATAR_BUCKET = 'user-avatars';
const AVATAR_FILE_NAME = 'avatar.webp';

function getAvatarPath(userId: string) {
    return `${userId}/${AVATAR_FILE_NAME}`;
}

async function listAllUserAvatarPaths(userId: string): Promise<string[]> {
    const paths: string[] = [];
    const pageSize = 100;
    let offset = 0;

    while (true) {
        const { data, error } = await supabase.storage
            .from(AVATAR_BUCKET)
            .list(userId, {
                limit: pageSize,
                offset,
                sortBy: { column: 'name', order: 'asc' },
            });

        if (error) throw error;

        const files = (data || []).filter(
            (item) => item.name && item.name !== '.emptyFolderPlaceholder'
        );

        paths.push(...files.map((item) => `${userId}/${item.name}`));

        if ((data || []).length < pageSize) break;
        offset += pageSize;
    }

    return paths;
}

async function removeAvatarPaths(paths: string[]) {
    const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
    if (uniquePaths.length === 0) return;

    const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove(uniquePaths);

    if (error) throw error;
}

export async function uploadStoreMemberAvatar(params: {
    memberId: string;
    userId: string;
    file: File;
    currentAvatarUrl?: string | null;
    reason?: string;
}) {
    const { memberId, userId, file, currentAvatarUrl, reason } = params;

    const optimized = await optimizeImageForUpload(file, IMAGE_PROFILES.avatar);
    const filePath = getAvatarPath(userId);

    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, optimized.file, {
            cacheControl: '31536000',
            upsert: true,
            contentType: 'image/webp',
        });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

    const versionedUrl = `${data.publicUrl}?v=${Date.now()}`;

    const { data: rpcData, error: rpcError } = await supabase.rpc(
        'update_store_member_avatar_url',
        {
            p_member_id: memberId,
            p_avatar_url: versionedUrl,
            p_reason: reason ?? 'Alteração de avatar pela tela de usuário.',
        }
    );

    if (rpcError) throw rpcError;

    // Após persistir a nova URL, remove todos os legados da pasta e preserva apenas avatar.webp.
    try {
        const existingPaths = await listAllUserAvatarPaths(userId);
        const legacyPaths = existingPaths.filter((path) => path !== filePath);

        if (currentAvatarUrl) {
            const oldPath = extractBucketPathFromUrl(currentAvatarUrl, AVATAR_BUCKET);
            if (oldPath && oldPath.startsWith(`${userId}/`) && oldPath !== filePath) {
                legacyPaths.push(oldPath);
            }
        }

        await removeAvatarPaths(legacyPaths);
    } catch (cleanupError) {
        // A nova foto e a referência já foram salvas; a falha de faxina não invalida o avatar.
        console.warn('[uploadStoreMemberAvatar] Não foi possível remover todos os avatares legados.', cleanupError);
    }

    return {
        avatarUrl: versionedUrl,
        result: Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData,
    };
}

/**
 * Remove todos os arquivos da pasta de avatar do usuário e limpa a referência no banco.
 * A operação só conclui no banco depois que o Storage confirmar a exclusão.
 */
export async function deleteStoreMemberAvatar(params: {
    memberId: string;
    userId: string;
    currentAvatarUrl?: string | null;
    reason?: string;
}) {
    const { memberId, userId, currentAvatarUrl, reason } = params;
    const pathsToRemove = new Set<string>(await listAllUserAvatarPaths(userId));

    pathsToRemove.add(getAvatarPath(userId));

    if (currentAvatarUrl) {
        const oldPath = extractBucketPathFromUrl(currentAvatarUrl, AVATAR_BUCKET);
        if (oldPath && oldPath.startsWith(`${userId}/`)) {
            pathsToRemove.add(oldPath);
        }
    }

    await removeAvatarPaths(Array.from(pathsToRemove));

    const { data: rpcData, error: rpcError } = await supabase.rpc(
        'update_store_member_avatar_url',
        {
            p_member_id: memberId,
            p_avatar_url: null,
            p_reason: reason ?? 'Remoção explícita de todos os avatares do usuário.',
        }
    );

    if (rpcError) throw rpcError;

    return {
        avatarUrl: null,
        removedPaths: Array.from(pathsToRemove),
        result: Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData,
    };
}
