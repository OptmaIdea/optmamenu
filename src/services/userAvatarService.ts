import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'user-avatars';

function getAvatarExtension(file: File): string {
    const extensionFromName = file.name.split('.').pop()?.toLowerCase();

    if (extensionFromName && ['jpg', 'jpeg', 'png', 'webp'].includes(extensionFromName)) {
        return extensionFromName === 'jpeg' ? 'jpg' : extensionFromName;
    }

    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';

    return 'jpg';
}

export async function uploadStoreMemberAvatar(params: {
    memberId: string;
    userId: string;
    file: File;
    reason?: string;
}) {
    const { memberId, userId, file, reason } = params;

    if (!file.type.startsWith('image/')) {
        throw new Error('Envie uma imagem válida.');
    }

    const maxSizeInMb = 2;
    const maxSize = maxSizeInMb * 1024 * 1024;

    if (file.size > maxSize) {
        throw new Error(`A imagem deve ter no máximo ${maxSizeInMb} MB.`);
    }

    const ext = getAvatarExtension(file);
    const filePath = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

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

    return {
        avatarUrl: publicUrl,
        result: Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData,
    };
}
