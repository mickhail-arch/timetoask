'use client';

import { useState, useCallback, useEffect } from 'react';
import { ScreenInput } from '@/components/seo-article/ScreenInput';
import { ScreenProgress } from '@/components/seo-article/ScreenProgress';
import type { ProgressStep } from '@/components/seo-article/ScreenProgress';
import { ScreenBrief } from '@/components/seo-article/ScreenBrief';
import { ScreenResult } from '@/components/seo-article/ScreenResult';
import { useSeoJobPolling } from '@/hooks/useSeoJobPolling';
import { copyArticle, downloadHTML, downloadDOCX, downloadMetadata } from '@/lib/seo-article/export';
import '@/components/seo-article/tokens.css';

type Screen = 'input' | 'progress_analysis' | 'brief' | 'progress_generation' | 'result';

const ANALYSIS_STEPS: ProgressStep[] = [
  { name: 'Модерация', description: 'Проверка контента...', status: 'pending', timeLabel: '~5 сек' },
  { name: 'Формирование ТЗ', description: 'Структура H1/H2/H3, LSI-ключи...', status: 'pending', timeLabel: '~20 сек' },
];

const GENERATION_STEPS: ProgressStep[] = [
  { name: 'Модерация заголовков', description: 'Проверка структуры...', status: 'pending', timeLabel: '~5 сек' },
  { name: 'Написание статьи', description: 'Генерация текста...', status: 'pending', timeLabel: '~70 сек' },
  { name: 'Проверка качества', description: 'SEO-аудит, AI-детект, правки...', status: 'pending', timeLabel: '~35 сек' },
  { name: 'Генерация изображений', description: 'Создание картинок...', status: 'pending', timeLabel: '~70 сек' },
  { name: 'Сборка и метаданные', description: 'HTML, Schema, мета-теги...', status: 'pending', timeLabel: '~20 сек' },
];

export function SeoArticleExpressClient() {
  const [screen, setScreen] = useState<Screen>('input');
  const [jobId, setJobId] = useState<string | null>(null);
  const [input, setInput] = useState<Record<string, unknown>>({});
  const [brief, setBrief] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<Record<string, unknown> | null>(null);

  const { state: jobState } = useSeoJobPolling(
    screen !== 'input' && screen !== 'result' ? jobId : null,
  );

  useEffect(() => {
    if (!jobState) return;

    if ((jobState.status === 'awaiting_confirmation' || jobState.progress === 15) && screen === 'progress_analysis' && jobState.brief) {
      setBrief(jobState.brief ?? null);
      setCalculatedPrice(jobState.calculatedPrice ?? 0);
      setScreen('brief');
    }

    if ((jobState.status === 'completed' || jobState.progress >= 100) && screen === 'progress_generation') {
      const raw = jobState.result as Record<string, unknown> ?? {};
      const assembly = raw.assembly as Record<string, unknown> ?? {};
      const imagesData = raw.images as Record<string, unknown> ?? {};
      setSavedImages(imagesData);
      const aiRevisions = raw.ai_detect_revisions as Record<string, unknown> ?? {};

      const flatResult = {
        article_html: (assembly.article_html as string) ?? '',
        article_docx_base64: (assembly.article_docx_base64 as string) ?? '',
        metadata: (assembly.metadata as Record<string, unknown>) ?? {},
        quality_metrics: (assembly.qualityMetrics as Record<string, number>)
          ?? (aiRevisions.qualityMetrics as Record<string, number>)
          ?? {},
        warnings: [
          ...((assembly.warnings as string[]) ?? []),
          ...((aiRevisions.warnings as string[]) ?? []),
        ],
      };

      setResult(flatResult);
      setScreen('result');
    }
  }, [jobState, screen]);

  const handleSubmit = useCallback(async (formInput: Record<string, unknown>) => {
    setInput(formInput);
    setSubmitError(null);
    setStartTime(Date.now());
    setScreen('progress_analysis');

    try {
      const res = await fetch('/api/tools/seo-article-express/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: formInput }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setJobId(json.data.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка отправки';
      console.error('Submit error:', message);
      setSubmitError(message);
      setScreen('input');
    }
  }, []);

  const handleConfirm = useCallback(async (updatedBrief: Record<string, unknown>, userEdited: boolean) => {
    setScreen('progress_generation');

    try {
      await fetch(`/api/jobs/${jobId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: updatedBrief, user_edited: userEdited }),
      });
    } catch (err) {
      console.error('Confirm error:', err);
    }
  }, [jobId]);

  const handleRegenerate = useCallback(async () => {
    if (!jobId || !brief) return;
    setResult(null);
    setStartTime(Date.now());
    setScreen('progress_generation');

    try {
      const res = await fetch(`/api/jobs/${jobId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          savedImages: savedImages ?? null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.data?.jobId) setJobId(json.data.jobId);
    } catch (err) {
      console.error('Regenerate error:', err);
      setScreen('result');
    }
  }, [jobId, brief, savedImages]);

  const handleCancel = useCallback(() => {
    setJobId(null);
    setScreen('input');
  }, []);

  const handleBack = useCallback(() => {
    setScreen('input');
  }, []);

  const duration = Math.round((Date.now() - startTime) / 1000);

  const mapSteps = (baseSteps: ProgressStep[], offset = 0): ProgressStep[] => {
    if (!jobState) return baseSteps;
    const adjustedStep = (jobState.currentStep ?? 0) - offset;
    return baseSteps.map((step, i) => {
      if (jobState.status === 'completed') return { ...step, status: 'done' as const };
      if (jobState.status === 'failed' && i === adjustedStep) {
        return { ...step, status: 'error' as const, description: jobState.error ?? 'Ошибка' };
      }
      if (i < adjustedStep) return { ...step, status: 'done' as const };
      if (i === adjustedStep) {
        return { ...step, status: 'running' as const, partialText: jobState.partialData };
      }
      return step;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {screen === 'input' && (
        <>
          {submitError && (
            <div className="mx-auto max-w-[640px] rounded-[var(--radius-md)] border border-[var(--color-step-error)] bg-[#FFF5F5] px-4 py-3 text-sm text-[var(--color-step-error)]">
              {submitError}
            </div>
          )}
          <ScreenInput onSubmit={handleSubmit} />
        </>
      )}

      {screen === 'progress_analysis' && (
        <ScreenProgress
          title="Анализ"
          subtitle={`«${(input.target_query as string) ?? ''}»`}
          steps={mapSteps(ANALYSIS_STEPS)}
          progress={jobState?.progress ?? 0}
          currentStepLabel={`осталось ~${Math.max(1, 15 - Math.round((Date.now() - startTime) / 1000))} сек`}
          onCancel={handleCancel}
        />
      )}

      {screen === 'brief' && brief && (
        <ScreenBrief
          brief={brief as any}
          charCount={(input.target_char_count as number) ?? 8000}
          imageCount={(input.image_count as number) ?? 0}
          faqCount={(input.faq_count as number) ?? 5}
          calculatedPrice={calculatedPrice}
          onConfirm={handleConfirm as any}
          onBack={handleBack}
        />
      )}

      {screen === 'progress_generation' && (
        <ScreenProgress
          title="Генерация"
          subtitle={`«${(input.target_query as string) ?? ''}»`}
          steps={mapSteps(GENERATION_STEPS, 2)}
          progress={jobState?.progress ?? 15}
          currentStepLabel={`осталось ~${Math.max(1, 90 - Math.round((Date.now() - startTime) / 1000))} сек`}
          onCancel={handleCancel}
        />
      )}

      {screen === 'result' && result && (
        <ScreenResult
          result={result as any}
          query={(input.target_query as string) ?? ''}
          stepCount={9}
          duration={duration}
          onCopyArticle={() => copyArticle((result as any).article_html ?? '')}
          onDownloadHtml={() => downloadHTML((result as any).article_html ?? '', (result as any).metadata?.slug ?? 'article')}
          onDownloadDocx={() => downloadDOCX((result as any).article_docx_base64 ?? '', (result as any).metadata?.file_name ?? 'article.docx')}
          onDownloadMetadata={() => downloadMetadata('', (result as any).metadata?.metadata_file_name ?? 'metadata.docx')}
          onNewArticle={() => { setScreen('input'); setJobId(null); setResult(null); }}
          onRegenerate={handleRegenerate}
        />
      )}
    </div>
  );
}
