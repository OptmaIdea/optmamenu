// src/components/common/ProgressCard.tsx


interface ProgressCardProps {
  title: string;
  value: number;
  max: number;
  color?: 'green' | 'orange' | 'blue';
  icon?: React.ReactNode;
  subtitle?: string;
}

export default function ProgressCard({
  title,
  value,
  max,
  color = 'green',
  icon,
  subtitle
}: ProgressCardProps) {
  const percentage = Math.min(100, Math.round((value / max) * 100));

  const colors = {
    green: {
      bg: 'bg-[#21A896]/10',
      fill: 'bg-[#21A896]',
      text: 'text-[#21A896]'
    },
    orange: {
      bg: 'bg-[#F26541]/10',
      fill: 'bg-[#F26541]',
      text: 'text-[#F26541]'
    },
    blue: {
      bg: 'bg-[#7B2D8E]/10',
      fill: 'bg-[#7B2D8E]',
      text: 'text-[#7B2D8E]'
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`p-2 ${colors[color].bg} rounded-lg ${colors[color].text}`}>
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 font-candara">
              {title}
            </h3>
            <p className="text-2xl font-black text-gray-800 dark:text-white font-candara-bold">
              {value}
              <span className="text-sm font-normal text-gray-400 ml-1">
                / {max}
              </span>
            </p>
          </div>
        </div>

        <div className={`text-lg font-black ${colors[color].text}`}>
          {percentage}%
        </div>
      </div>

      <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${colors[color].fill} rounded-full transition-all duration-1000`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {subtitle && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 font-candara">
          {subtitle}
        </p>
      )}
    </div>
  );
}