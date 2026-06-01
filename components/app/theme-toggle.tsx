'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? theme === 'dark' : true;
  const label = isDark ? 'Светлая тема' : 'Тёмная тема';

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={collapsed ? label : undefined}
      className="w-full justify-start gap-3 h-9 px-2.5 text-muted-foreground hover:text-foreground"
    >
      {isDark ? (
        <Sun className="size-[18px] shrink-0" />
      ) : (
        <Moon className="size-[18px] shrink-0" />
      )}
      <span
        className={cn(
          'truncate transition-opacity duration-150',
          collapsed && 'pointer-events-none opacity-0',
        )}
      >
        {label}
      </span>
    </Button>
  );
}
