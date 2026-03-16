'use client';

import { useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StreamResultProps {
  content: string;
  isStreaming: boolean;
  outputFormat: string;
  onReset?: () => void;
}

function BlinkingCursor() {
  return (
    <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-text-primary align-middle" />
  );
}

function ContentRenderer({
  content,
  outputFormat,
  isStreaming,
}: {
  content: string;
  outputFormat: string;
  isStreaming: boolean;
}) {
  switch (outputFormat) {
    case 'markdown':
      return (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
          {isStreaming && <BlinkingCursor />}
        </div>
      );

    case 'html':
      return (
        <div>
          {/* eslint-disable-next-line react/no-danger */}
          <div dangerouslySetInnerHTML={{ __html: content }} />
          {isStreaming && <BlinkingCursor />}
        </div>
      );

    case 'json':
      return (
        <pre className="overflow-x-auto rounded-lg bg-bg-sidebar p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono text-text-primary">
          {content}
          {isStreaming && <BlinkingCursor />}
        </pre>
      );

    default:
      return (
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-primary">
          {content}
          {isStreaming && <BlinkingCursor />}
        </pre>
      );
  }
}

export function StreamResult({
  content,
  isStreaming,
  outputFormat,
  onReset,
}: StreamResultProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Скопировано в буфер обмена');
    } catch {
      toast.error('Не удалось скопировать');
    }
  }, [content]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-bg-surface p-6"
      >
        <ContentRenderer
          content={content}
          outputFormat={outputFormat}
          isStreaming={isStreaming}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!content}
        >
          <Copy size={16} />
          Копировать
        </Button>

        {!isStreaming && content && onReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
          >
            <RotateCcw size={16} />
            Новый запрос
          </Button>
        )}
      </div>
    </div>
  );
}
