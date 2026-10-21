import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const variants = cva('btn', {variants:{variant:{default:'btn-primary',outline:'btn-outline',ghost:'btn-ghost',destructive:'btn-danger'},size:{default:'',sm:'btn-sm'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof variants>) {
  return <button className={twMerge(clsx(variants({variant,size}),className))} {...props}/>;
}
