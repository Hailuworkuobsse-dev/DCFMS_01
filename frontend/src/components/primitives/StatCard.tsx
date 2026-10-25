import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '../../lib/utils/format';

export interface StatCardProps {
  label?: string;
  title?: string;
  value: string;
  delta?: string;
  change?: string;
  deltaDirection?: 'up' | 'down' | 'neutral';
  trend?: 'up' | 'down' | 'neutral';
  sparkline?: number[];
  icon?: React.ReactNode;
  color?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  title,
  value,
  delta,
  change,
  deltaDirection,
  trend,
  sparkline,
  icon,
  className,
}) => {
  const displayLabel = title || label || '';
  const displayDelta = change || delta;
  const effectiveTrend = trend || deltaDirection || 'neutral';

  return (
    <div
      className={cn(
        'bg-white border border-stone-200 p-4 flex flex-col justify-between transition-all hover:border-stone-400 shadow-xs',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-stone-600 truncate">
          {displayLabel}
        </span>
        {icon ? (
          <div className="p-1.5 bg-stone-100 text-stone-800">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="text-2xl font-bold font-mono text-stone-900 tabular-nums tracking-tight">
          {value}
        </div>
        {displayDelta ? (
          <div
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-mono font-medium px-1.5 py-0.5 whitespace-nowrap',
              effectiveTrend === 'up' && 'text-forest-800 bg-forest-50 border border-forest-200',
              effectiveTrend === 'down' && 'text-rose-800 bg-rose-50 border border-rose-200',
              effectiveTrend === 'neutral' && 'text-stone-600 bg-stone-100 border border-stone-200'
            )}
          >
            {effectiveTrend === 'up' ? (
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            ) : effectiveTrend === 'down' ? (
              <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{displayDelta}</span>
          </div>
        ) : null}
      </div>

      {sparkline && sparkline.length > 1 ? (
        <div className="mt-3 pt-2 border-t border-stone-100 flex items-end gap-1 h-5" aria-hidden="true">
          {(() => {
            const max = Math.max(...sparkline, 1);
            return sparkline.map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-forest-700/60 transition-all hover:bg-forest-800"
                style={{ height: `${Math.max(15, (v / max) * 100)}%` }}
              />
            ));
          })()}
        </div>
      ) : null}
    </div>
  );
};
