'use client';
import { useState } from 'react';
import { CopyButton } from './ExportPanel';

interface MetaPanelProps {
  title: string;
  titleLength: number;
  description: string;
  descriptionLength: number;
  editable?: boolean;
  onChangeTitle?: (value: string) => void;
  onChangeDescription?: (value: string) => void;
}

export function MetaPanel({
  title,
  titleLength,
  description,
  descriptionLength,
  editable,
  onChangeTitle,
  onChangeDescription,
}: MetaPanelProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  const titleOver = title.length > 200;
  const descOver = description.length > 300;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Мета-теги</div>

      {/* Title */}
      <div className="flex items-start justify-between border-b border-[#F0F0F0] pb-2.5 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-[var(--color-text-secondary)]">Title ({titleLength} симв)</span>
            {editable && (
              <span className={`text-[10px] ${titleOver ? 'text-red-500 font-medium' : 'text-[var(--color-text-secondary)]'}`}>
                {title.length}/200
              </span>
            )}
          </div>
          {editable && editingTitle ? (
            <input
              autoFocus
              className="border-none bg-transparent outline-none text-[13px] w-full"
              value={title}
              maxLength={200}
              onChange={e => onChangeTitle?.(e.target.value)}
              onBlur={() => setEditingTitle(false)}
            />
          ) : (
            <div
              className={`text-[13px] break-words ${editable ? 'cursor-text rounded hover:bg-black/[0.03] px-0.5 -mx-0.5' : ''} ${titleOver ? 'text-red-500' : ''}`}
              onClick={() => editable && setEditingTitle(true)}
            >
              {title || <span className="text-[var(--color-text-secondary)] italic">Нет данных</span>}
            </div>
          )}
        </div>
        <CopyButton text={title} />
      </div>

      {/* Description */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-[var(--color-text-secondary)]">Description ({descriptionLength} симв)</span>
            {editable && (
              <span className={`text-[10px] ${descOver ? 'text-red-500 font-medium' : 'text-[var(--color-text-secondary)]'}`}>
                {description.length}/300
              </span>
            )}
          </div>
          {editable && editingDescription ? (
            <textarea
              autoFocus
              className="border-none bg-transparent outline-none text-[13px] w-full resize-none"
              value={description}
              maxLength={300}
              rows={3}
              onChange={e => onChangeDescription?.(e.target.value)}
              onBlur={() => setEditingDescription(false)}
            />
          ) : (
            <div
              className={`text-[13px] break-words ${editable ? 'cursor-text rounded hover:bg-black/[0.03] px-0.5 -mx-0.5' : ''} ${descOver ? 'text-red-500' : ''}`}
              onClick={() => editable && setEditingDescription(true)}
            >
              {description || <span className="text-[var(--color-text-secondary)] italic">Нет данных</span>}
            </div>
          )}
        </div>
        <CopyButton text={description} />
      </div>
    </div>
  );
}
