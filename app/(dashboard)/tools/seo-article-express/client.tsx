// app/(dashboard)/tools/seo-article-express/client.tsx

'use client';

import { useState, useCallback, useEffect } from 'react';
import { ScreenInput } from '@/components/seo-article/ScreenInput';
import { ScreenProgress } from '@/components/seo-article/ScreenProgress';
import type { ProgressStep } from '@/components/seo-article/ScreenProgress';
import { ScreenBrief } from '@/components/seo-article/ScreenBrief';
import { ScreenResult } from '@/components/seo-article/ScreenResult';
import { useSeoJobPolling } from '@/hooks/useSeoJobPolling';
import { copyArticle, downloadHTML, downloadDOCX, downloadMetadata } from '@/lib/seo-article/export';
import { SessionHistory } from '@/components/seo-article/SessionHistory';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import type { SessionFull } from '@/hooks/useSessionHistory';
import '@/components/seo-article/tokens.css';

function notifyArticleReady(query: string) {
  // Мигание вкладки
  const originalTitle = document.title;
  let blink = true;
  const interval = setInterval(() => {
    document.title = blink ? '✅ готово!' : originalTitle;
    blink = !blink;
  }, 1000);
  const stopBlink = () => {
    clearInterval(interval);
    document.title = originalTitle;
    window.removeEventListener('focus', stopBlink);
  };
  window.addEventListener('focus', stopBlink);
  if (document.hasFocus()) setTimeout(stopBlink, 5000);

  // Браузерное push-уведомление
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Статья готова', { body: query, icon: '/favicon.ico' });
  }
}

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
  const [inputKey, setInputKey] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { sessions, loading: sessionsLoading, refresh: refreshSessions, loadSession, deleteSession } = useSessionHistory('seo-article-express');

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
        images_map: (imagesData.images_map as Record<string, { base64?: string; url?: string }>) ?? {},
      };

      setResult(flatResult);
      setScreen('result');
      notifyArticleReady((input.target_query as string) ?? '');

      // Автосохранение сессии
      try {
        const inputParams = input;
        const title = (inputParams.target_query as string) ?? 'Без названия';
        const meta = {
          metadata: flatResult.metadata,
          quality_metrics: flatResult.quality_metrics,
          warnings: flatResult.warnings,
        };

        fetch('/api/sessions/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolSlug: 'seo-article-express',
            title,
            inputParams,
            outputMeta: meta,
            contentText: flatResult.article_html,
            tokensUsed: calculatedPrice,
            durationSec: Math.round((Date.now() - startTime) / 1000),
          }),
        }).then(async (res) => {
          if (res.ok) {
            const json = await res.json();
            setActiveSessionId(json.data?.id ?? null);
            refreshSessions();
          }
        });
      } catch (err) {
        console.error('Failed to save session:', err);
      }
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

  const handleRegenerate = useCallback(() => {
    setResult(null);
    setJobId(null);
    setInputKey(k => k + 1);
    setScreen('input');
  }, []);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    const data = await loadSession(sessionId);
    if (!data || !data.contentText) return;

    setActiveSessionId(sessionId);
    setInput(data.inputParams ?? {});

    const meta = (data.outputMeta ?? {}) as Record<string, unknown>;
    setResult({
      article_html: data.contentText,
      article_docx_base64: '',
      metadata: meta.metadata ?? {},
      quality_metrics: meta.quality_metrics ?? {},
      warnings: (meta.warnings as string[]) ?? [],
    });

    setBrief(null);
    setJobId(null);
    setScreen('result');
  }, [loadSession]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteSession(sessionId);
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setScreen('input');
      setResult(null);
    }
  }, [deleteSession, activeSessionId]);

  const handleNewFromHistory = useCallback(() => {
    setActiveSessionId(null);
    setScreen('input');
    setResult(null);
    setJobId(null);
    setInput({});
    setInputKey(k => k + 1);
  }, []);

  const handleSaveEdits = useCallback(async (data: { articleHtml: string; metadata: Record<string, unknown> }) => {
    if (!activeSessionId) return;
    await fetch(`/api/sessions/${activeSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentText: data.articleHtml,
        outputMeta: { ...(result as any)?.quality_metrics ? { quality_metrics: (result as any).quality_metrics } : {}, metadata: data.metadata, warnings: (result as any)?.warnings },
      }),
    });
    setResult(prev => prev ? { ...prev, article_html: data.articleHtml, metadata: data.metadata } : prev);
    refreshSessions();
  }, [activeSessionId, result, refreshSessions]);

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
    <>
      <SessionHistory
        sessions={sessions}
        loading={sessionsLoading}
        activeSessionId={activeSessionId}
        onSelect={handleSelectSession}
        onDelete={handleDeleteSession}
        onNewArticle={handleNewFromHistory}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          {screen === 'input' && (
            <>
              {submitError && (
                <div className="mx-auto max-w-[640px] rounded-[var(--radius-md)] border border-[var(--color-step-error)] bg-[#FFF5F5] px-4 py-3 text-sm text-[var(--color-step-error)]">
                  {submitError}
                </div>
              )}
              <ScreenInput key={inputKey} onSubmit={handleSubmit} initialValues={input} />
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
              key={activeSessionId ?? jobId ?? 'result'}
              result={result as any}
              query={(input.target_query as string) ?? ''}
              stepCount={9}
              duration={duration}
              onCopyArticle={() => copyArticle((result as any).article_html ?? '')}
              onDownloadHtml={() => downloadHTML((result as any).article_html ?? '', (result as any).metadata?.slug ?? 'article')}
              onDownloadDocx={() => downloadDOCX((result as any).article_docx_base64 ?? '', (result as any).metadata?.file_name ?? 'article.docx')}
              onDownloadMetadata={() => downloadMetadata('', (result as any).metadata?.metadata_file_name ?? 'metadata.docx')}
              onNewArticle={() => { setScreen('input'); setJobId(null); setResult(null); setActiveSessionId(null); setInput({}); setInputKey(k => k + 1); }}
              onRegenerate={handleRegenerate}
              sessionId={activeSessionId}
              onSave={handleSaveEdits}
            />
          )}
        </div>
      </div>
    </>
  );
}
