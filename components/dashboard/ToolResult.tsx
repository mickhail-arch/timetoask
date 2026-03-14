'use client';

import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ToolResultProps {
  result: unknown;
  outputFormat: string;
}

function ResultContent({ result, outputFormat }: ToolResultProps) {
  const text =
    typeof result === 'string' ? result : JSON.stringify(result, null, 2);

  switch (outputFormat) {
    case 'markdown':
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      );

    case 'html':
      return (
        <div className="space-y-2">
          <Badge variant="secondary" className="text-xs">HTML output</Badge>
          <div
            className="rounded-md border border-amber-200 bg-amber-50 p-1 dark:border-amber-800 dark:bg-amber-950"
          >
            <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
              Raw HTML — rendered as-is
            </p>
            {/* eslint-disable-next-line react/no-danger */}
            <div dangerouslySetInnerHTML={{ __html: text }} />
          </div>
        </div>
      );

    default:
      return (
        <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {text}
        </pre>
      );
  }
}

export function ToolResult({ result, outputFormat }: ToolResultProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Результат</CardTitle>
      </CardHeader>
      <CardContent>
        <ResultContent result={result} outputFormat={outputFormat} />
      </CardContent>
    </Card>
  );
}
