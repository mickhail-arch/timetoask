import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        accent:
          'bg-accent text-text-primary hover:bg-accent-hover disabled:bg-accent-disabled disabled:text-text-secondary',
        ghost:
          'bg-transparent text-text-primary hover:bg-border/40',
        outline:
          'border border-border bg-transparent text-text-primary hover:bg-border/20',
        danger:
          'bg-error/10 text-error hover:bg-error/20',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-lg',
        md: 'h-11 px-5 text-base rounded-lg',
        lg: 'h-[52px] px-6 text-base rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'accent',
      size: 'md',
    },
  },
);

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && 'w-full',
          className,
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
