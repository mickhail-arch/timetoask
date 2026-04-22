'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { RewritePanel } from './rewrite-panel';

export interface RichEditorProps {
  html: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  articleTitle?: string;
}

export function RichEditor({ html, onChange, className, placeholder, readOnly, articleTitle }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [rewriteData, setRewriteData] = useState<{
    fragment: string;
    range: Range;
    contextBefore: string;
    contextAfter: string;
    sectionTitle: string;
    position: { top: number };
  } | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = html;
      initialized.current = true;
    }
  }, [html]);

  const emitChange = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.querySelectorAll('a[href]').forEach(a => {
        if (!a.getAttribute('target')) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener');
        }
      });
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const updateToolbar = useCallback(() => {
    if (readOnly) return;
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
    const toolbarWidth = 360;
    setToolbarPos({
      top: rect.top - editorRect.top - 44,
      left: Math.max(0, Math.min(
        rect.left - editorRect.left + rect.width / 2 - toolbarWidth / 2,
        editorRect.width - toolbarWidth
      )),
    });
  }, [readOnly]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateToolbar);
    return () => document.removeEventListener('selectionchange', updateToolbar);
  }, [updateToolbar]);

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitChange();
  }, [emitChange]);

  const handleFormat = useCallback((tag: string) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === tag) {
        document.execCommand('formatBlock', false, 'p');
        emitChange();
        return;
      }
      node = node.parentNode;
    }

    document.execCommand('formatBlock', false, tag);
    emitChange();
  }, [emitChange]);

  const handleList = useCallback((command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
    emitChange();
  }, [emitChange]);

  const handleLink = useCallback(() => {
    const url = prompt('URL ссылки:');
    if (url) {
      editorRef.current?.focus();
      document.execCommand('createLink', false, url);
      if (editorRef.current) {
        editorRef.current.querySelectorAll('a[href]').forEach(a => {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener');
        });
      }
      emitChange();
    }
  }, [emitChange]);

  const handleOpenRewrite = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !editorRef.current) return;

    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    const fragment = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(fragment);
    const fragmentHtml = div.innerHTML;

    let sectionTitle = '';
    let node: Node | null = range.startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName.toLowerCase();
        if (tag === 'h2' || tag === 'h3') {
          sectionTitle = (node as Element).textContent ?? '';
          break;
        }
      }
      let prev = node.previousSibling;
      while (prev) {
        if (prev.nodeType === Node.ELEMENT_NODE) {
          const tag = (prev as Element).tagName.toLowerCase();
          if (tag === 'h2' || tag === 'h3') {
            sectionTitle = (prev as Element).textContent ?? '';
            break;
          }
        }
        prev = prev.previousSibling;
      }
      if (sectionTitle) break;
      node = node.parentNode;
    }

    const tempRange = range.cloneRange();
    tempRange.setStart(editorRef.current, 0);
    const beforeDiv = document.createElement('div');
    beforeDiv.appendChild(tempRange.cloneContents());
    const contextBefore = beforeDiv.textContent?.slice(-500) ?? '';
    const contextAfter = editorRef.current.textContent?.slice(
      (beforeDiv.textContent?.length ?? 0) + (div.textContent?.length ?? 0)
    )?.slice(0, 500) ?? '';

    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    setRewriteData({
      fragment: fragmentHtml,
      range: range.cloneRange(),
      contextBefore,
      contextAfter,
      sectionTitle,
      position: { top: rect.top - editorRect.top },
    });

    setToolbarPos(null);
  }, []);

  const handleClearFormat = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('removeFormat');
    document.execCommand('formatBlock', false, 'p');
    emitChange();
  }, [emitChange]);

  const handleInput = useCallback(() => {
    emitChange();
  }, [emitChange]);

  const BTN = 'flex items-center justify-center w-8 h-8 rounded hover:bg-[#333] transition-colors cursor-pointer select-none text-white/90';
  const SEP = 'w-px h-5 bg-white/20 mx-0.5 self-center';

  return (
    <div style={{ position: 'relative' }}>
      {toolbarPos && (
        <div
          ref={toolbarRef}
          className="absolute z-50 flex items-center rounded-lg bg-[#1F1F1F] px-1.5 py-1 shadow-xl"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onMouseDown={e => e.preventDefault()}
        >
          <button className={BTN} onClick={() => handleFormat('h2')} title="Заголовок H2">
            <span className="text-[13px] font-bold">H2</span>
          </button>
          <button className={BTN} onClick={() => handleFormat('h3')} title="Заголовок H3">
            <span className="text-[13px] font-bold">H3</span>
          </button>

          <div className={SEP} />

          <button className={BTN} onClick={() => handleFormat('blockquote')} title="Цитата">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>
          </button>

          <div className={SEP} />

          <button className={BTN} onClick={() => handleList('insertOrderedList')} title="Нумерованный список">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
          </button>
          <button className={BTN} onClick={() => handleList('insertUnorderedList')} title="Маркированный список">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
          </button>

          <div className={SEP} />

          <button className={BTN} onClick={() => exec('bold')} title="Жирный">
            <span className="text-[15px] font-bold">B</span>
          </button>
          <button className={BTN} onClick={() => exec('italic')} title="Курсив">
            <span className="text-[15px] italic font-serif">I</span>
          </button>
          <button className={BTN} onClick={() => exec('strikethrough')} title="Зачёркнутый">
            <span className="text-[15px] line-through">S</span>
          </button>

          <div className={SEP} />

          <button className={BTN} onClick={handleLink} title="Ссылка">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6a5 5 0 0 1 0-10h3"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </button>

          <button className={BTN} onClick={handleClearFormat} title="Очистить форматирование">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16"/><path d="M5.5 13.5 9 17"/><path d="m9.5 4 8.5 8.5-4.5 4.5"/><path d="m11.5 6.5 5 5"/></svg>
          </button>

          <div className={SEP} />
          <button
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer select-none bg-[var(--color-accent)] text-black hover:brightness-90"
            onClick={handleOpenRewrite}
            title="Переписать с AI"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            Переписать с AI
          </button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        className={className}
        data-placeholder={placeholder}
        style={{ outline: 'none', minHeight: 360, resize: 'vertical', overflowY: 'auto' }}
      />

      <style>{`
        [contenteditable] a[href] { color: #2563eb; text-decoration: underline; }
        [contenteditable] a[href]:hover { color: #1d4ed8; }
        [contenteditable] blockquote { border-left: 3px solid #E0E0E0; padding-left: 12px; margin: 8px 0; color: #555; }
        [contenteditable] ul { list-style: disc; padding-left: 24px; }
        [contenteditable] ol { list-style: decimal; padding-left: 24px; }
        [contenteditable] s { text-decoration: line-through; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #999; }
      `}</style>

      {rewriteData && (
        <RewritePanel
          fragment={rewriteData.fragment}
          contextBefore={rewriteData.contextBefore}
          contextAfter={rewriteData.contextAfter}
          sectionTitle={rewriteData.sectionTitle}
          articleTitle={articleTitle ?? ''}
          position={rewriteData.position}
          onApply={(rewritten) => {
            const sel = window.getSelection();
            if (sel && editorRef.current) {
              sel.removeAllRanges();
              sel.addRange(rewriteData.range);
              document.execCommand('insertHTML', false, rewritten);
              emitChange();
            }
            setRewriteData(null);
          }}
          onCancel={() => setRewriteData(null)}
        />
      )}
    </div>
  );
}
