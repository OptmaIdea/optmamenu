interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
}

export default function LoadingSpinner({ size = 'md', text = 'Carregando...' }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-6 w-6 border-2',
        md: 'h-8 w-8 border-2',
        lg: 'h-12 w-12 border-4',
    };

    return (
        <div className="min-h-[50vh] flex items-center justify-center">
            <div className="text-center">
                <div
                    className={`
                        animate-spin rounded-full border-b-2 border-[#19A999] mx-auto mb-4
                        ${sizeClasses[size]}
                    `}
                />
                {text && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-candara">
                        {text}
                    </p>
                )}
            </div>
        </div>
    );
}