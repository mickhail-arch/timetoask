'use client';

import { useState, useCallback } from 'react';

export interface HeadingItem {
  id: string;
  text: string;
  h3s: Array<{ id: string; text: string }>;
}

interface BriefHeadingsProps {
  h1: string;
  h2List: HeadingItem[];
  onH1Change: (text: string) => void;
  onChange: (h2List: HeadingItem[]) => void;
}

let nextId = 100;
const genId = () => `h-${nextId++}`;

export function BriefHeadings({ h1, h2List, onH1Change, onChange }: BriefHeadingsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragGroupIdx, setDragGroupIdx] = useState<number | null>(null);
  const [dragH3, setDragH3] = useState<{ gi: number; ci: number } | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragOverH3, setDragOverH3] = useState<{ gi: number; ci: number } | null>(null);

  const startEdit = useCallback((id: string) => setEditingId(id), []);

  const saveEdit = useCallback((id: string, text: string) => {
    const val = text.trim() || 'Без названия';
    if (id === 'h1') { onH1Change(val); setEditingId(null); return; }
    const updated = h2List.map(h2 => {
      if (h2.id === id) return { ...h2, text: val };
      return { ...h2, h3s: h2.h3s.map(h3 => h3.id === id ? { ...h3, text: val } : h3) };
    });
    onChange(updated);
    setEditingId(null);
  }, [h2List, onChange, onH1Change]);

  const deleteH2 = useCallback((idx: number) => {
    onChange(h2List.filter((_, i) => i !== idx));
  }, [h2List, onChange]);

  const deleteH3 = useCallback((gi: number, ci: number) => {
    const updated = h2List.map((h2, i) =>
      i === gi ? { ...h2, h3s: h2.h3s.filter((_, j) => j !== ci) } : h2
    );
    onChange(updated);
  }, [h2List, onChange]);

  const addH2 = useCallback(() => {
    const id = genId();
    onChange([{ id, text: 'Новый раздел', h3s: [] }, ...h2List]);
    setEditingId(id);
  }, [h2List, onChange]);

  const addH2After = useCallback((gi: number) => {
    const id = genId();
    const updated = [...h2List];
    updated.splice(gi + 1, 0, { id, text: 'Новый раздел', h3s: [] });
    onChange(updated);
    setEditingId(id);
  }, [h2List, onChange]);

  const addH3ToH2 = useCallback((gi: number) => {
    const id = genId();
    const updated = h2List.map((h2, i) =>
      i === gi ? { ...h2, h3s: [...h2.h3s, { id, text: 'Новый подраздел' }] } : h2
    );
    onChange(updated);
    setEditingId(id);
  }, [h2List, onChange]);

  const addH3AfterH3 = useCallback((gi: number, ci: number) => {
    const id = genId();
    const updated = h2List.map((h2, i) => {
      if (i !== gi) return h2;
      const h3s = [...h2.h3s];
      h3s.splice(ci + 1, 0, { id, text: 'Новый подраздел' });
      return { ...h2, h3s };
    });
    onChange(updated);
    setEditingId(id);
  }, [h2List, onChange]);

  const onH2DragStart = (idx: number) => { setDragGroupIdx(idx); setDragH3(null); };
  const onH2DragOver = (idx: number) => { if (dragGroupIdx !== null && dragGroupIdx !== idx) setDragOverIdx(idx); };
  const onH2Drop = (idx: number) => {
    if (dragGroupIdx !== null && dragGroupIdx !== idx) {
      const items = [...h2List];
      const [moved] = items.splice(dragGroupIdx, 1);
      items.splice(idx, 0, moved);
      onChange(items);
    }
    setDragGroupIdx(null); setDragOverIdx(null);
  };
  const onH2DragEnd = () => { setDragGroupIdx(null); setDragOverIdx(null); };

  const onH3DragStart = (gi: number, ci: number, e: React.DragEvent) => {
    e.stopPropagation();
    setDragH3({ gi, ci }); setDragGroupIdx(null);
  };
  const onH3DragOver = (gi: number, ci: number, e: React.DragEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (dragH3 && dragH3.gi === gi && dragH3.ci !== ci) setDragOverH3({ gi, ci });
  };
  const onH3Drop = (gi: number, ci: number, e: React.DragEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (dragH3 && dragH3.gi === gi && dragH3.ci !== ci) {
      const updated = [...h2List];
      const h3s = [...updated[gi].h3s];
      const [moved] = h3s.splice(dragH3.ci, 1);
      h3s.splice(ci, 0, moved);
      updated[gi] = { ...updated[gi], h3s };
      onChange(updated);
    }
    setDragH3(null); setDragOverH3(null);
  };
  const onH3DragEnd = () => { setDragH3(null); setDragOverH3(null); };

  const renderEditable = (id: string, text: string) => {
    if (editingId === id) {
      return (
        <input
          autoFocus
          defaultValue={text}
          maxLength={100}
          onBlur={e => saveEdit(id, e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingId(null); }}
          className="min-w-0 flex-1 rounded border border-[var(--seo-input-focus)] px-1.5 py-0.5 text-[13px] outline-none"
        />
      );
    }
    return <span className="min-w-0 flex-1 break-words text-[13px] text-[var(--color-text-primary)]" style={{ lineHeight: '1.2' }}>{text}</span>;
  };

  return (
    <div>
      {/* H1 */}
      <div className="mb-1.5 flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--seo-card-border)] bg-[#FAFAFA] px-2.5 py-2">
        <span className="invisible text-sm">⠿</span>
        <button onClick={addH2} className="flex h-[24px] w-[24px] shrink-0 items-center justify-center text-sm text-[var(--color-step-pending)] hover:text-[var(--color-step-running)]">+</button>
        <span className="shrink-0 rounded bg-[var(--seo-badge-h1)] px-1.5 py-0.5 text-[10px] font-medium text-white">H1</span>
        {renderEditable('h1', h1)}
        <button onClick={() => startEdit('h1')} className="shrink-0 text-sm text-[var(--color-step-pending)] hover:text-[var(--color-text-primary)]">✏</button>
      </div>

      {/* H2 groups */}
      {h2List.map((h2, gi) => (
        <div
          key={h2.id}
          draggable
          onDragStart={() => onH2DragStart(gi)}
          onDragOver={e => { e.preventDefault(); onH2DragOver(gi); }}
          onDrop={() => onH2Drop(gi)}
          onDragEnd={onH2DragEnd}
          className={`mb-1 transition-opacity ${dragGroupIdx === gi ? 'opacity-40' : ''}`}
        >
          <div className={`flex items-center gap-1 rounded-[var(--radius-md)] border px-2.5 py-2 transition-all ${
            dragOverIdx === gi ? 'border-[var(--color-step-running)] bg-[var(--color-brief-bg)]' : 'border-[var(--seo-card-border)] bg-white'
          }`}>
            <span className="cursor-grab text-sm text-[var(--color-step-pending)] active:cursor-grabbing">⠿</span>
            <button onClick={e => { e.stopPropagation(); addH2After(gi); }} className="flex h-[24px] w-[24px] shrink-0 items-center justify-center text-sm text-[var(--color-step-pending)] hover:text-[var(--color-step-running)]">+</button>
            <span className="shrink-0 rounded bg-[var(--seo-badge-h2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-primary)]">H2</span>
            {renderEditable(h2.id, h2.text)}
            <button onClick={() => startEdit(h2.id)} className="shrink-0 text-sm text-[var(--color-step-pending)] hover:text-[var(--color-text-primary)]">✏</button>
            <button onClick={() => deleteH2(gi)} className="shrink-0 text-sm text-[var(--color-step-pending)] hover:text-[var(--color-step-error)]">×</button>
          </div>

          {/* H3s */}
          {h2.h3s.length > 0 && (
            <div className="ml-[30px]">
              {h2.h3s.map((h3, ci) => (
                <div
                  key={h3.id}
                  draggable
                  onDragStart={e => onH3DragStart(gi, ci, e)}
                  onDragOver={e => onH3DragOver(gi, ci, e)}
                  onDrop={e => onH3Drop(gi, ci, e)}
                  onDragEnd={onH3DragEnd}
                  className={`mt-1 flex items-center gap-1 rounded-[var(--radius-md)] border px-2.5 py-2 transition-all ${
                    dragH3?.gi === gi && dragH3?.ci === ci ? 'opacity-40' : ''
                  } ${
                    dragOverH3?.gi === gi && dragOverH3?.ci === ci ? 'border-[var(--color-step-running)] bg-[var(--color-brief-bg)]' : 'border-[#F0F0F0] bg-white'
                  }`}
                >
                  <span className="cursor-grab text-sm text-[var(--color-step-pending)] active:cursor-grabbing">⠿</span>
                  <button onClick={e => { e.stopPropagation(); addH3AfterH3(gi, ci); }} className="flex h-[24px] w-[24px] shrink-0 items-center justify-center text-sm text-[var(--color-step-pending)] hover:text-[var(--color-step-running)]">+</button>
                  <span className="shrink-0 rounded bg-[var(--seo-badge-h3)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">H3</span>
                  {renderEditable(h3.id, h3.text)}
                  <button onClick={() => startEdit(h3.id)} className="shrink-0 text-sm text-[var(--color-step-pending)] hover:text-[var(--color-text-primary)]">✏</button>
                  <button onClick={() => deleteH3(gi, ci)} className="shrink-0 text-sm text-[var(--color-step-pending)] hover:text-[var(--color-step-error)]">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

    </div>
  );
}
