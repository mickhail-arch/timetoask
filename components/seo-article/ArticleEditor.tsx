'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface ArticleEditorProps {
  html: string;
  onChange: (html: string) => void;
  className?: string;
}

export function ArticleEditor({ html, onChange, className }: ArticleEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);

  const initialized = useRef(false);
  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = html;
      initialized.current = true;
    }
  }, [html]);

  const updateToolbar = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !editorRef.current) {
      setToolbarPos(null);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      setToolbarPos(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    setToolbarPos({
      top: rect.top - editorRect.top - 44,
      left: Math.max(0, Math.min(rect.left - editorRect.left + rect.width / 2 - 180, editorRect.width - 360)),
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateToolbar);
    return () => document.removeEventListener('selectionchange', updateToolbar);
  }, [updateToolbar]);

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.querySelectorAll('a[href]').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      });
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleLink = useCallback(() => {
    const url = prompt('URL ссылки:');
    if (url) exec('createLink', url);
  }, [exec]);

  const handleClearFormat = useCallback(() => {
    exec('removeFormat');
    document.execCommand('formatBlock', false, 'p');
    handleInput();
  }, [exec, handleInput]);

  const BTN = 'px-2 py-1 text-[12px] hover:bg-[#333] rounded transition-colors cursor-pointer select-none';
  const SEP = 'w-px h-4 bg-[#444] mx-0.5 self-center';

  return (
    <div className="relative" style={{ position: 'relative' }}>
      {toolbarPos && (
        <div
          ref={toolbarRef}
          className="absolute z-50 flex items-center gap-0.5 rounded-lg bg-[#1F1F1F] px-1 py-1 text-white shadow-lg"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onMouseDown={e => e.preventDefault()}
        >
          <button className={BTN} onClick={() => exec('formatBlock', 'h2')} title="H2">H2</button>
          <button className={BTN} onClick={() => exec('formatBlock', 'h3')} title="H3">H3</button>
          <div className={SEP} />
          <button className={`${BTN} font-bold`} onClick={() => exec('bold')} title="Жирный">B</button>
          <button className={`${BTN} italic`} onClick={() => exec('italic')} title="Курсив">I</button>
          <button className={`${BTN} line-through`} onClick={() => exec('strikethrough')} title="Зачёркнутый">S</button>
          <div className={SEP} />
          <button className={BTN} onClick={handleLink} title="Ссылка">&#128279;</button>
          <div className={SEP} />
          <button className={BTN} onClick={() => exec('insertOrderedList')} title="Нумерованный список">1.</button>
          <button className={BTN} onClick={() => exec('insertUnorderedList')} title="Маркированный список">&bull;</button>
          <div className={SEP} />
          <button className={BTN} onClick={handleClearFormat} title="Очистить стили">&#9003;</button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className={className}
        style={{ outline: 'none', minHeight: 360, resize: 'vertical' }}
      />
    </div>
  );
}
