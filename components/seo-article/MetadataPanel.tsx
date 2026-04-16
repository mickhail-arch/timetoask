'use client';
import { useState } from 'react';
import { CopyButton } from './ExportPanel';

interface MetadataPanelProps {
  pageName: string;
  slug: string;
  breadcrumb: string;
  altTexts: string[];
  jsonLd: string;
  editable?: boolean;
  onChangePageName?: (value: string) => void;
  onChangeSlug?: (value: string) => void;
  onChangeBreadcrumb?: (value: string) => void;
  onChangeAltText?: (index: number, value: string) => void;
}

export function MetadataPanel({
  pageName,
  slug,
  breadcrumb,
  altTexts,
  jsonLd,
  editable,
  onChangePageName,
  onChangeSlug,
  onChangeBreadcrumb,
  onChangeAltText,
}: MetadataPanelProps) {
  const allAlts = altTexts.map((a, i) => `${i + 1}. ${a}`).join('\n');

  const slugValidate = (value: string) =>
    /[а-яёА-ЯЁ]/.test(value) ? 'Только латиница, цифры и дефисы' : null;

  const slugChange = (value: string) => {
    if (/[а-яёА-ЯЁ]/.test(value)) return;
    onChangeSlug?.(value.toLowerCase());
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Метаданные для вставки</div>

      <Row label="Страница" value={pageName} editable={editable} onChange={onChangePageName} />
      <Row
        label="ЧПУ / Slug"
        value={slug}
        editable={editable}
        onChange={slugChange}
        validate={slugValidate}
      />
      <Row label="Хлебные крошки" value={breadcrumb} editable={editable} onChange={onChangeBreadcrumb} />

      {altTexts.length > 0 && (
        <div className="border-t border-[#F0F0F0] py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-secondary)]">Изображения ({altTexts.length} шт)</span>
            <CopyButton text={allAlts} label="Все alt-тексты" />
          </div>
          {altTexts.map((alt, i) => (
            <AltRow
              key={i}
              index={i}
              value={alt}
              editable={editable}
              onChange={onChangeAltText ? (v) => onChangeAltText(i, v) : undefined}
            />
          ))}
        </div>
      )}

      <div className="border-t border-[#F0F0F0] pt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] text-[var(--color-text-secondary)]">JSON-LD Schema</span>
          <CopyButton text={jsonLd} />
        </div>
        <div
          className="min-h-[80px] max-h-[300px] overflow-y-auto rounded-[var(--radius-sm)] border border-[#F0F0F0] bg-[#FAFAFA] px-2.5 py-2 font-mono text-[11px] text-[#444] break-words whitespace-pre-wrap"
          style={{ resize: 'vertical' }}
        >
          {jsonLd}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  maxLength?: number;
  validate?: (value: string) => string | null;
}

function Row({ label, value, editable, onChange, maxLength, validate }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = (next: string) => {
    if (validate) {
      const err = validate(next);
      setValidationError(err);
      if (err) return;
    }
    onChange?.(next);
  };

  const handleBlur = () => {
    setEditing(false);
    setValidationError(null);
  };

  return (
    <div className="flex items-start justify-between border-b border-[#F0F0F0] py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div>
        {editable && editing ? (
          <div>
            <input
              autoFocus
              className="border-none bg-transparent outline-none text-[13px] w-full"
              value={value}
              maxLength={maxLength}
              onChange={e => handleChange(e.target.value)}
              onBlur={handleBlur}
            />
            {validationError && (
              <div className="text-[11px] text-red-500 mt-0.5">{validationError}</div>
            )}
          </div>
        ) : (
          <div
            className={`text-[13px] break-words ${editable ? 'cursor-text rounded hover:bg-black/[0.03] px-0.5 -mx-0.5' : ''}`}
            onClick={() => editable && setEditing(true)}
          >
            {value || <span className="text-[var(--color-text-secondary)] italic">Нет данных</span>}
          </div>
        )}
      </div>
      <CopyButton text={value} />
    </div>
  );
}

interface AltRowProps {
  index: number;
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

function AltRow({ index, value, editable, onChange }: AltRowProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-[#F5F5F5] py-1.5 last:border-0">
      <span className="mr-1.5 text-xs text-[var(--color-text-secondary)] shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        {editable && editing ? (
          <input
            autoFocus
            className="border-none bg-transparent outline-none text-xs w-full"
            value={value}
            onChange={e => onChange?.(e.target.value)}
            onBlur={() => setEditing(false)}
          />
        ) : (
          <span
            className={`text-xs break-words block ${editable ? 'cursor-text rounded hover:bg-black/[0.03] px-0.5 -mx-0.5' : ''}`}
            onClick={() => editable && setEditing(true)}
          >
            {value}
          </span>
        )}
      </div>
      <CopyButton text={value} />
    </div>
  );
}
