import React from 'react';

export function Button({className='', variant='default', size='default', ...props}: React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?:'default'|'gold'|'ghost'|'outline', size?:'default'|'sm'|'lg'|'icon'}) {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-all disabled:opacity-50 disabled:pointer-events-none';
  const sizes: any = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-12 px-6 text-base',
    icon: 'h-9 w-9'
  };
  const variants: any = {
    default: 'brass-button',
    gold: 'brass-gold shadow',
    ghost: 'hover:bg-[var(--bg-card)] text-[var(--text-secondary)]',
    outline: 'border border-[var(--border)] hover:border-[var(--border-brass)] bg-transparent',
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}
