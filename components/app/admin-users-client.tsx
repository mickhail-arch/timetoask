'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';

type Row = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  supportLevel: string | null;
};

export function AdminUsersClient() {
  const { update } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users?limit=100');
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? 'Ошибка'); return; }
      setRows(json.data.users);
    } catch {
      setError('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const impersonate = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/impersonate/${id}`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error?.message ?? 'Не удалось войти');
        return;
      }
      await update({ action: 'impersonate' });
      router.push('/tools');
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const setAccess = async (id: string, access: 'none' | 'view' | 'full') => {
    setBusy(id);
    try {
      await fetch(`/api/admin/users/${id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-sm text-[var(--color-text-secondary)]">Загрузка...</p>;
  if (error) return <p className="text-sm text-[var(--color-step-error)]">{error}</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-bg-surface)] text-left text-[var(--color-text-secondary)]">
          <tr>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Роль</th>
            <th className="px-4 py-2 font-medium">Доступ поддержки</th>
            <th className="px-4 py-2 font-medium text-right">Войти</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-4 py-2 text-[var(--color-text-primary)]">{u.email}</td>
              <td className="px-4 py-2 text-[var(--color-text-secondary)]">{u.role}</td>
              <td className="px-4 py-2">
                {u.role === 'admin' ? (
                  <span className="text-[var(--color-text-secondary)]">—</span>
                ) : (
                  <select
                    value={u.role === 'support' ? (u.supportLevel ?? 'none') : 'none'}
                    onChange={(e) => setAccess(u.id, e.target.value as 'none' | 'view' | 'full')}
                    disabled={busy === u.id}
                    className="rounded-md border border-border bg-[var(--color-bg-input)] px-2 py-1 text-[var(--color-text-primary)]"
                  >
                    <option value="none">Нет</option>
                    <option value="view">Просмотр</option>
                    <option value="full">Полный</option>
                  </select>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                {u.role !== 'admin' && (
                  <button
                    onClick={() => impersonate(u.id)}
                    disabled={busy === u.id}
                    title="Войти в аккаунт (режим поддержки)"
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-accent)] disabled:opacity-50"
                  >
                    <LogIn className="size-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
