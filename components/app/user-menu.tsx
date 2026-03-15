'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { LogOut, Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  email: string;
  role: string;
}

export function UserMenu({ email, role }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const initial = email.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1 transition-colors hover:bg-[var(--color-border)]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-text-primary">
          {initial}
        </span>
        <span className="text-sm text-text-primary">{email}</span>
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-48 rounded-[var(--radius-lg)] border border-border bg-bg-surface py-1',
            'shadow-[var(--shadow-md)] z-[var(--z-dropdown)]',
          )}
        >
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-[var(--color-border)] transition-colors"
          >
            <User size={16} />
            Профиль
          </Link>

          {role === 'admin' && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-[var(--color-border)] transition-colors"
            >
              <Shield size={16} />
              Админка
            </Link>
          )}

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-[var(--color-border)] transition-colors"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}
