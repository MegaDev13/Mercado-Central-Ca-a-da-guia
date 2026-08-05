import React from 'react';
export function Input({className='', ...props}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[rgba(212,175,55,0.4)] focus:ring-1 focus:ring-[rgba(212,175,55,0.2)] ${className}`} {...props} />;
}
export function Textarea({className='', ...props}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`w-full min-h-[100px] rounded-lg bg-[var(--bg-input)] border border-[var(--border)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[rgba(212,175,55,0.4)] focus:ring-1 focus:ring-[rgba(212,175,55,0.2)] ${className}`} {...props} />;
}
export function Label({className='', ...props}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-xs font-semibold tracking-widest uppercase text-[var(--text-secondary)] ${className}`} {...props} />;
}
