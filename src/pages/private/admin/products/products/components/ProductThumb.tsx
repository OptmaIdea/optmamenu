import { useState } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '../types/product.types';

interface ProductThumbProps {
    product: Product;
    size?: 'sm' | 'md' | 'lg';
}

export default function ProductThumb({ product, size = 'md' }: ProductThumbProps) {
    const [hasError, setHasError] = useState(false);
    const imgSrc = product.images && product.images.length > 0 ? product.images[0] : null;

    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-10 h-10',
    };

    if (!imgSrc || hasError) {
        return (
            <div
                className={`
          ${sizeClasses[size]} flex items-center justify-center 
          text-gray-400 bg-gray-100 dark:bg-gray-700 rounded
        `}
            >
                <Package size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
            </div>
        );
    }

    return (
        <img
            src={imgSrc}
            alt={product.name}
            className={`${sizeClasses[size]} object-cover rounded`}
            onError={() => setHasError(true)}
            loading="lazy"
        />
    );
}