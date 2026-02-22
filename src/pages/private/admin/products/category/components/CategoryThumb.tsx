import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface CategoryThumbProps {
    imageUrl?: string | null;
    name?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export default function CategoryThumb({
    imageUrl,
    name,
    size = 'md',
    className = '',
}: CategoryThumbProps) {
    const [hasError, setHasError] = useState(false);

    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-16 h-16',
    };

    if (!imageUrl || hasError) {
        return (
            <div
                className={`
                    ${sizeClasses[size]} 
                    rounded-lg bg-gray-100 dark:bg-gray-700 
                    flex items-center justify-center text-gray-400
                    ${className}
                `}
            >
                <ImageIcon size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} />
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={name || 'Categoria'}
            className={`
                ${sizeClasses[size]} 
                rounded-lg object-cover border border-gray-200 dark:border-gray-600
                ${className}
            `}
            onError={() => setHasError(true)}
            loading="lazy"
        />
    );
}