import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, htmlFor, children, ...props }: LabelProps) {
    return (
        <label
            htmlFor={htmlFor}
            className={cn(
                'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                className,
            )}
            {...props}
        >
            {children}
        </label>
    );
}
