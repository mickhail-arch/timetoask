'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, disabled, id, ...props }, ref) => {
    const inputId = id || React.useId();
    const isPassword = type === 'password';
    const [show, setShow] = React.useState(false);
    const effectiveType = isPassword && show ? 'text' : type;

    return (
      <div className="w-full">
        <div className="relative">
          <input
            id={inputId}
            type={effectiveType}
            disabled={disabled}
            placeholder=" "
            className={cn(
              'peer w-full rounded-lg border bg-bg-input px-4 pt-5 pb-2 text-base text-text-primary outline-none transition-colors',
              'placeholder-transparent',
              isPassword && 'pr-12',
              error
                ? 'border-border-error [border-width:1.5px]'
                : 'border-border focus:border-border-focus focus:[border-width:1.5px]',
              disabled && 'cursor-not-allowed bg-bg-sidebar',
              className,
            )}
            ref={ref}
            {...props}
          />
          {label && (
            <label
              htmlFor={inputId}
              className={cn(
                'pointer-events-none absolute left-4 origin-[0] transition-all',
                'top-1/2 -translate-y-1/2 text-base font-medium',
                'peer-focus:top-2.5 peer-focus:-translate-y-0 peer-focus:text-xs',
                'peer-not-placeholder-shown:top-2.5 peer-not-placeholder-shown:-translate-y-0 peer-not-placeholder-shown:text-xs',
                error
                  ? 'text-error'
                  : 'text-text-secondary peer-focus:text-text-primary',
              )}
            >
              {label}
            </label>
          )}
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((v) => !v)}
              disabled={disabled}
              aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed"
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-1.5 text-sm text-error">{error}</p>
        )}
        {!error && hint && (
          <p className="mt-1.5 text-sm text-text-secondary">{hint}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
