import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ProgressProps = HTMLAttributes<HTMLDivElement> & {
    value: number;
    max?: number;
};

export function Progress({ value, max = 100, className, 'aria-label': ariaLabel, ...props }: ProgressProps) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div
            role="progressbar"
            tabIndex={-1}
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={ariaLabel ?? 'Progress'}
            className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
            {...props}
        >
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
    );
}
