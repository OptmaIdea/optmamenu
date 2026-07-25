import { supabase } from '@/lib/supabase';
import { optimizeImageForUpload, createSafeImageFilename, IMAGE_PROFILES } from '@/utils/imageOptimization';

const AVATAR_BUCKET = 'user-avatars';

export async function uploadStoreMemberAvatar(params: {
    memberId: string;
    userId: string;
    file: File;
    reason?: string;
}) {
    const { memberId, userId, file, reason } = params;

    const optimized = await optimizeImageForUpload(file, IMAGE_PROFILES.avatar);
    const safeName = createSafeImageFilename(file.name, 'avatar');
    const filePath = `${userId}/${safeName}`;

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
