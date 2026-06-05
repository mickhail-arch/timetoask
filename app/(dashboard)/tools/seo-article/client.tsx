// app/(dashboard)/tools/seo-article-express/client.tsx

'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m} мин ${rem} сек` : `${rem} сек`;
}

type Screen = 'input' | 'progress_analysis' | 'brief' | 'progress_generation' | 'result';

const ANALYSIS_STEPS: ProgressStep[] = [
  { name: 'Модерация', description: 'Проверка контента...', status: 'pending', timeLabel: '~5 сек' },
  { name: 'Анализ конкурентов', description: 'Serper + мета-теги...', status: 'pending', timeLabel: '~15 сек' },
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
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [phaseStartMs, setPhaseStartMs] = useState<number | null>(null);
  const [genStart, setGenStart] = useState(0);
  const [finalDuration, setFinalDuration] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<Record<string, unknown> | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [runningJobs, setRunningJobs] = useState<Record<string, string>>({}); // sessionId → jobId
  const [unseenIds, setUnseenIds] = useState<string[]>([]);
  const draftDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionTokenRef = useRef(0);
  const currentJobIdRef = useRef<string | null>(null);
  const autoRestoreDoneRef = useRef(false);
  const { sessions, loading: sessionsLoading, refresh: refreshSessions, loadSession, deleteSession, addSessionOptimistic } = useSessionHistory('seo-article-express');

  // Cleanup: удаляем из runningJobs сессии, которые в БД уже completed/failed.
  // Без этого спиннер «Генерация...» зависает в истории на завершённых сессиях.
  useEffect(() => {
    if (sessions.length === 0) return;
    setRunningJobs(prev => {
      let changed = false;
      const next = { ...prev };
      for (const sid of Object.keys(prev)) {
        const session = sessions.find(s => s.id === sid);
        if (!session) {
          delete next[sid];
          changed = true;
          continue;
        }
        if (session.status === 'completed' || session.status === 'failed') {
          delete next[sid];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sessions]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Живой счётчик времени генерации (тикает раз в секунду на экране генерации)
  useEffect(() => {
    if (screen !== 'progress_generation') return;
    setNowTick(Date.now());
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [screen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ls = JSON.parse(localStorage.getItem('seo:unseen') ?? '[]') as string[];
    setUnseenIds(ls);
  }, [sessions]);


  const { state: jobState } = useSeoJobPolling(
    screen !== 'input' && screen !== 'result' ? jobId : null,
  );

  // ВРЕМЕННЫЙ ЛОГ — найти кто поллит
  useEffect(() => {
    const pollJobId = screen !== 'input' && screen !== 'result' ? jobId : null;
    if (pollJobId) {
      console.log('[poll-source]', { pollJobId, screen, activeSessionId });
    }
  }, [jobId, screen, activeSessionId]);

  useEffect(() => {
    if (!jobState) return;
    console.log('[jobState]', {
      jobId,
      status: jobState.status,
      progress: jobState.progress,
      stepName: jobState.stepName,
      hasBrief: !!jobState.brief,
      briefH2Count: (jobState.brief as { h2_list?: unknown[] } | undefined)?.h2_list?.length ?? 0,
      uiScreen: screen,
    });

    // Запоминаем jobId, который сейчас релевантен
    if (jobId !== currentJobIdRef.current) {
      currentJobIdRef.current = jobId;
    }

    // FAILED: возвращаем на input только если jobState относится к текущему jobId
    // (защита от устаревших ответов polling-а при быстром переключении сессий)
    if (jobState.status === 'failed') {
      // Если jobState пришёл для устаревшего job — игнорируем
      if (jobId && currentJobIdRef.current && jobId !== currentJobIdRef.current) {
        return;
      }
      if (screen !== 'input' && screen !== 'result') {
        setSubmitError(jobState.error ?? 'Ошибка генерации');
        setScreen('input');
        const sid = activeSessionId ?? draftSessionId;
        if (sid) {
          fetch(`/api/sessions/${sid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'failed' }),
          }).then(() => refreshSessions());
        }
      }
      return;
    }

    // AWAITING_CONFIRMATION: показываем brief, если он есть
    if (jobState.status === 'awaiting_confirmation') {
      setPhaseStartMs((prev) => {
        if (prev !== null) setAccumulatedMs((acc) => acc + (Date.now() - prev));
        return null;
      });
      if (jobState.brief && (jobState.brief as any).h2_list) {
        if (screen === 'progress_analysis' || screen === 'progress_generation' || (screen === 'brief' && !brief)) {
          setBrief(jobState.brief);
          setCalculatedPrice(jobState.calculatedPrice ?? 0);
          if (screen !== 'brief') {
            setScreen('brief');
            const sid = activeSessionId ?? draftSessionId;
            if (sid) {
              fetch(`/api/sessions/${sid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'awaiting_confirmation' }),
              }).then(() => refreshSessions());
            }
          }
        }
      }
      return;
    }

    // COMPLETED: всегда переключаем на result, независимо от screen
    if (jobState.status === 'completed' || jobState.progress >= 100) {
      setPhaseStartMs((prev) => {
        if (prev !== null) setAccumulatedMs((acc) => acc + (Date.now() - prev));
        return null;
      });
      if (screen === 'progress_analysis' || screen === 'progress_generation' || screen === 'brief') {
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
        setFinalDuration(genStart ? Math.floor((Date.now() - genStart) / 1000) : Math.round(accumulatedMs / 1000));
        setScreen('result');
        notifyArticleReady((input.target_query as string) ?? '');

        try {
          const inputParams = input;
          const title = (inputParams.target_query as string) ?? 'Без названия';
          const meta = {
            metadata: flatResult.metadata,
            quality_metrics: flatResult.quality_metrics,
            warnings: flatResult.warnings,
          };

          const sessionIdToUpdate = activeSessionId ?? draftSessionId;
          if (sessionIdToUpdate) {
            // Бэк сам обновит ToolSession через syncSessionStatus(jobId, 'completed').
            // Фронт только помечает unseen и обновляет локальный список.
            const ls = JSON.parse(localStorage.getItem('seo:unseen') ?? '[]') as string[];
            if (!ls.includes(sessionIdToUpdate)) {
              localStorage.setItem('seo:unseen', JSON.stringify([...ls, sessionIdToUpdate]));
            }
            setUnseenIds(JSON.parse(localStorage.getItem('seo:unseen') ?? '[]'));
            setDraftSessionId(null);
            setRunningJobs(prev => { const next = { ...prev }; delete next[sessionIdToUpdate]; return next; });
            refreshSessions();
          } else {
            // Эта ветка — fallback. После B1.server-atomic сессия всегда есть.
            // Если оказались здесь — сервер сам создаст/обновит запись.
            refreshSessions();
          }
        } catch (err) {
          console.error('Failed to save session:', err);
        }
      }
      return;
    }

    // PROCESSING: переключаем экраны по progress
    if (jobState.status === 'processing') {
      setPhaseStartMs((prev) => (prev === null ? Date.now() : prev));
      // После confirm pipeline идёт дальше — на любом progress > 15 переключаемся
      if (jobState.progress > 15 && screen === 'progress_analysis') {
        setScreen('progress_generation');
      }
      // Если мы на brief (только что нажали Подтвердить) — переключаемся на generation
      if (screen === 'brief') {
        setScreen('progress_generation');
      }
      if (jobState.progress < 15 && screen === 'progress_generation') {
        setScreen('progress_analysis');
      }
      if (screen === 'input' || screen === 'result') {
        setScreen(jobState.progress > 15 ? 'progress_generation' : 'progress_analysis');
      }
    }
  }, [jobState, screen, brief, activeSessionId, draftSessionId, input, calculatedPrice, accumulatedMs, phaseStartMs, refreshSessions]);

  const handleQueryChange = useCallback((query: string) => {
    const trimmed = query.trim();

    if (!trimmed && draftSessionId) {
      deleteSession(draftSessionId);
      setDraftSessionId(null);
      return;
    }

    if (!trimmed) return;

    if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
    draftDebounceRef.current = setTimeout(async () => {
      if (draftSessionId) {
        await fetch(`/api/sessions/${draftSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed }),
        });
        refreshSessions();
      } else {
        try {
          const res = await fetch('/api/sessions/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toolSlug: 'seo-article-express',
              title: trimmed,
              inputParams: {},
              outputMeta: {},
              contentText: null,
              tokensUsed: 0,
              durationSec: 0,
              status: 'draft',
            }),
          });
          if (res.ok) {
            const json = await res.json();
            setDraftSessionId(json.data?.id ?? null);
            setActiveSessionId(json.data?.id ?? null);
            refreshSessions();
          }
        } catch {}
      }
    }, 800);
  }, [draftSessionId, deleteSession, refreshSessions]);

  const handleSubmit = useCallback(async (formInput: Record<string, unknown>) => {
    setInput(formInput);
    setSubmitError(null);
    setAccumulatedMs(0);
    setPhaseStartMs(Date.now());
    setScreen('progress_analysis');

    // Сервер атомарно создаст/обновит ToolSession + JobStep + reserve в одной транзакции.
    // Передаём draftSessionId если есть — сервер подцепится к существующей draft-сессии.
    try {
      const res = await fetch('/api/tools/seo-article-express/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: formInput,
          sessionId: draftSessionId ?? activeSessionId ?? undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      const newJobId = json.data.jobId as string;
      const newSessionId = json.data.sessionId as string;

      setJobId(newJobId);
      setActiveSessionId(newSessionId);
      setDraftSessionId(null);
      setRunningJobs(prev => ({ ...prev, [newSessionId]: newJobId }));
      refreshSessions();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const message =
        raw && !raw.startsWith('[') && !raw.startsWith('HTTP')
          ? raw
          : 'Кажется, тема или ключевые слова заполнены некорректно. Опишите понятную тему статьи и ключи.';
      setSubmitError(message);
      setScreen('input');
    }
  }, [draftSessionId, activeSessionId, refreshSessions]);

  const handleConfirm = useCallback(async (updatedBrief: Record<string, unknown>, userEdited: boolean) => {
    if (confirming) return;
    setConfirming(true);
    setGenStart(Date.now());
    setFinalDuration(null);
    setScreen('progress_generation');

    try {
      await fetch(`/api/jobs/${jobId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: updatedBrief, user_edited: userEdited }),
      });
    } catch (err) {
      console.error('Confirm error:', err);
    } finally {
      setConfirming(false);
    }
  }, [jobId, confirming]);

  const handleRegenerate = useCallback(async () => {
    // Перегенерация = НОВАЯ статья с теми же параметрами.
    // Старая сессия остаётся нетронутой в истории.
    const currentInput = input;
    const title = ((currentInput as Record<string, unknown>).target_query as string) ?? 'Без названия';

    // Полностью отвязываемся от текущей открытой сессии
    setResult(null);
    setJobId(null);
    setActiveSessionId(null);
    setDraftSessionId(null);
    setBrief(null);
    setSubmitError(null);
    setInputKey(k => k + 1);
    setScreen('input');

    if (!title.trim()) return;

    // Создаём НОВЫЙ черновик в истории с теми же параметрами
    try {
      const res = await fetch('/api/sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolSlug: 'seo-article-express',
          title,
          inputParams: currentInput,
          outputMeta: {},
          contentText: null,
          tokensUsed: 0,
          durationSec: 0,
          status: 'draft',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const newDraft = json.data;
        const newDraftId = newDraft?.id ?? null;
        if (newDraftId) {
          setDraftSessionId(newDraftId);
          setActiveSessionId(newDraftId);
          // Оптимистично показываем черновик в истории сразу
          addSessionOptimistic({
            id: newDraftId,
            title: (newDraft.title as string) ?? title,
            status: 'draft',
            version: (newDraft.version as number) ?? 1,
            parentId: (newDraft.parentId as string | null) ?? null,
            tokensUsed: 0,
            durationSec: 0,
            outputMeta: {},
            createdAt: (newDraft.createdAt as string) ?? new Date().toISOString(),
          });
          refreshSessions();
        }
      }
    } catch (err) {
      console.error('Failed to create draft on regenerate:', err);
    }
  }, [input, refreshSessions, addSessionOptimistic]);

  const handleCopySession = useCallback(async (sessionId: string) => {
    // Загружаем полные данные сессии (нужны inputParams)
    const data = await loadSession(sessionId);
    if (!data) return;

    const sourceInput = data.inputParams ?? {};
    const title = ((sourceInput as Record<string, unknown>).target_query as string) ?? (data.title ?? 'Копия');

    // Открываем форму с скопированными параметрами как новый черновик
    setResult(null);
    setJobId(null);
    setActiveSessionId(null);
    setDraftSessionId(null);
    setBrief(null);
    setSubmitError(null);
    setInput(sourceInput);
    setInputKey(k => k + 1);
    setScreen('input');

    try {
      const res = await fetch('/api/sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolSlug: 'seo-article-express',
          title,
          inputParams: sourceInput,
          outputMeta: {},
          contentText: null,
          tokensUsed: 0,
          durationSec: 0,
          status: 'draft',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const newDraft = json.data;
        const newDraftId = newDraft?.id ?? null;
        if (newDraftId) {
          setDraftSessionId(newDraftId);
          setActiveSessionId(newDraftId);
          refreshSessions();
        }
      }
    } catch (err) {
      console.error('Failed to copy session:', err);
    }
  }, [loadSession, refreshSessions]);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    // Инкрементируем токен — все предыдущие in-flight запросы становятся устаревшими
    const myToken = ++selectionTokenRef.current;
    const isStale = () => selectionTokenRef.current !== myToken;

    const data = await loadSession(sessionId);
    if (isStale()) return;
    if (!data) return;

    setActiveSessionId(sessionId);
    setInput(data.inputParams ?? {});
    setSubmitError(null);

    const meta = (data.outputMeta ?? {}) as Record<string, unknown>;
    const storedJobId = runningJobs[sessionId] ?? (meta.jobId as string | undefined) ?? null;

    // Снять "непрочитано"
    if (typeof window !== 'undefined') {
      const ls = JSON.parse(localStorage.getItem('seo:unseen') ?? '[]') as string[];
      if (ls.includes(sessionId)) {
        localStorage.setItem('seo:unseen', JSON.stringify(ls.filter(id => id !== sessionId)));
        setUnseenIds(JSON.parse(localStorage.getItem('seo:unseen') ?? '[]'));
        refreshSessions();
      }
    }

    // ПРИОРИТЕТ: есть готовый контент — сразу показываем result, не глядя на jobId/статус.
    // Убирает мелькание экрана прогресса при клике на завершённую статью.
    if (data.contentText && data.contentText.length > 0) {
      if (runningJobs[sessionId]) {
        setRunningJobs(prev => { const next = { ...prev }; delete next[sessionId]; return next; });
      }
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
      return;
    }

    // 2. Failed
    if (data.status === 'failed') {
      if (isStale()) return;
      setJobId(null);
      setBrief(null);
      setResult(null);
      setSubmitError('Предыдущая генерация завершилась ошибкой');
      setScreen('input');
      setInputKey(k => k + 1);
      return;
    }

    // 3. Активная сессия (generating / awaiting_confirmation)
    if (data.status === 'generating' || data.status === 'awaiting_confirmation') {
      if (!storedJobId) {
        // Сиротская сессия: статус 'generating'/'awaiting_confirmation', но jobId не записан.
        // Помечаем как failed и показываем форму с заполненными значениями + сообщение.
        if (isStale()) return;
        try {
          await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'failed' }),
          });
          refreshSessions();
        } catch {}
        if (isStale()) return;
        setSubmitError('Сессия была прервана. Можно перезапустить генерацию с теми же параметрами.');
        setJobId(null);
        setScreen('input');
        setInputKey(k => k + 1);
        return;
      }

      if (isStale()) return;
      setJobId(storedJobId);
      setBrief(null);
      setResult(null);

      // Оптимистично сразу показываем прогресс, не дожидаясь /api/jobs/.../status
      // Это убирает мерцание формы во время быстрых переключений
      setScreen(data.status === 'awaiting_confirmation' ? 'brief' : 'progress_analysis');

      // Запрашиваем реальный статус для уточнения экрана и подгрузки brief
      let realStatus: string | null = null;
      let realBrief: Record<string, unknown> | null = null;
      let realPrice: number | undefined;
      let realProgress = 0;
      try {
        const jobRes = await fetch(`/api/jobs/${storedJobId}/status`);
        if (isStale()) return;
        if (jobRes.ok) {
          const json = await jobRes.json();
          if (isStale()) return;
          realStatus = json.data?.status ?? null;
          realBrief = json.data?.brief ?? null;
          realPrice = json.data?.calculatedPrice;
          realProgress = json.data?.progress ?? 0;
        }
      } catch {}

      if (isStale()) return;

      if (realStatus === 'completed') {
        const fresh = await loadSession(sessionId);
        if (isStale()) return;
        const freshMeta = (fresh?.outputMeta ?? {}) as Record<string, unknown>;
        if (fresh?.contentText) {
          setResult({
            article_html: fresh.contentText,
            article_docx_base64: '',
            metadata: (freshMeta.metadata as Record<string, unknown>) ?? {},
            quality_metrics: (freshMeta.quality_metrics as Record<string, number>) ?? {},
            warnings: (freshMeta.warnings as string[]) ?? [],
          });
          setJobId(null);
          setScreen('result');
        } else {
          setScreen(realProgress > 15 ? 'progress_generation' : 'progress_analysis');
        }
        return;
      }

      if (realStatus === 'failed') {
        setJobId(null);
        setSubmitError('Предыдущая генерация завершилась ошибкой');
        setScreen('input');
        setInputKey(k => k + 1);
        return;
      }

      if (realStatus === 'awaiting_confirmation' && realBrief && (realBrief as { h2_list?: unknown }).h2_list) {
        setBrief(realBrief);
        setCalculatedPrice(realPrice ?? 0);
        setScreen('brief');
        return;
      }

      // processing / null — уточняем экран по progress
      setScreen(realProgress > 15 ? 'progress_generation' : 'progress_analysis');
      return;
    }

    // 4. draft без контента — форма
    if (isStale()) return;
    setJobId(null);
    setBrief(null);
    setResult(null);
    setScreen('input');
    setInputKey(k => k + 1);
  }, [loadSession, runningJobs, refreshSessions]);

  useEffect(() => {
    if (autoRestoreDoneRef.current) return;
    if (sessionsLoading) return;
    if (jobId) {
      // Если jobId уже выставлен (HMR, навигация назад) — считаем, что восстанавливать нечего
      autoRestoreDoneRef.current = true;
      return;
    }
    if (activeSessionId) {
      autoRestoreDoneRef.current = true;
      return;
    }
    if (screen !== 'input') {
      autoRestoreDoneRef.current = true;
      return;
    }

    const active = sessions.find(
      s => s.status === 'generating' || s.status === 'awaiting_confirmation',
    );

    // Помечаем done независимо от того, нашлась сессия или нет — больше не пытаемся
    autoRestoreDoneRef.current = true;

    if (!active) return;
    handleSelectSession(active.id);
  }, [sessionsLoading, sessions, jobId, activeSessionId, screen, handleSelectSession]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteSession(sessionId);
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setScreen('input');
      setResult(null);
    }
  }, [deleteSession, activeSessionId]);

  const handleNewFromHistory = useCallback(() => {
    // НЕ сбрасываем jobId — polling автоматически встаёт на паузу когда screen='input'
    setActiveSessionId(null);
    setDraftSessionId(null);
    setResult(null);
    setScreen('input');
    setInputKey(k => k + 1);
    setInput({});
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

  const handleCancel = useCallback(async () => {
    const cancelId = jobId;
    setJobId(null);
    setScreen('input');
    autoRestoreDoneRef.current = true; // не давать авто-восстановлению поднять отменённую сессию
    if (cancelId) {
      try {
        await fetch(`/api/jobs/${cancelId}/cancel`, { method: 'POST' });
      } catch {
        // даже если запрос не прошёл — UI уже сброшен
      }
    }
    refreshSessions();
  }, [jobId, refreshSessions]);

  const handleInputChange = useCallback((formData: Record<string, unknown>) => {
    setInput(formData);
  }, []);

  const handleBack = useCallback(() => {
    setScreen('input');
  }, []);

  const activeJobs = useMemo(() => {
    const jobs: Record<string, { status: string; progress: number; stepName: string }> = {};
    // Текущая активная генерация (с реальным прогрессом из polling)
    if (activeSessionId && jobState && jobState.status === 'processing') {
      jobs[activeSessionId] = {
        status: jobState.status,
        progress: jobState.progress ?? 0,
        stepName: jobState.stepName ?? '',
      };
    }
    // Фоновые генерации (без точного прогресса — просто "в процессе")
    for (const sid of Object.keys(runningJobs)) {
      if (!jobs[sid]) {
        jobs[sid] = { status: 'processing', progress: 0, stepName: '' };
      }
    }
    return jobs;
  }, [activeSessionId, jobState, runningJobs]);

  const totalActiveMs = accumulatedMs + (phaseStartMs !== null ? Date.now() - phaseStartMs : 0);
  const duration = Math.max(0, Math.round(totalActiveMs / 1000));
  const genElapsed = genStart ? Math.floor((nowTick - genStart) / 1000) : 0;

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
        onCopy={handleCopySession}
        onNewArticle={handleNewFromHistory}
        activeJobs={activeJobs}
        unseenIds={unseenIds}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          {screen === 'input' && (
            <>
              {submitError && (
                <div className="mb-4 animate-fadeIn rounded-[var(--radius-md)] border border-[var(--color-step-error)] bg-[var(--color-step-error)]/10 px-4 py-3 text-sm text-[var(--color-step-error)]">
                  {submitError}
                </div>
              )}
              <ScreenInput key={inputKey} onSubmit={handleSubmit} initialValues={input} onQueryChange={handleQueryChange} onInputChange={handleInputChange} />
            </>
          )}

          {screen === 'progress_analysis' && (
            <ScreenProgress
              title="Анализ"
              subtitle={`«${(input.target_query as string) ?? ''}»`}
              steps={mapSteps(ANALYSIS_STEPS)}
              progress={jobState?.progress ?? 0}
              currentStepLabel={`осталось ~${Math.max(5, Math.round((15 - (jobState?.progress ?? 0)) * 2.5))} сек`}
              onCancel={handleCancel}
            />
          )}

          {screen === 'brief' && brief && (
            <>
              <ScreenBrief
                brief={brief as any}
                charCount={(input.target_char_count as number) ?? 8000}
                imageCount={(input.image_count as number) ?? 0}
                faqCount={(input.faq_count as number) ?? 0}
                calculatedPrice={calculatedPrice}
                comparisonEnabled={(input.comparison_enabled as boolean) ?? false}
                competitorMeta={jobState?.competitorMeta ?? jobState?.result?.competitorMeta ?? jobState?.result?.research?.competitorMeta ?? []}
                onConfirm={handleConfirm as any}
                onBack={handleBack}
              />
            </>
          )}

          {screen === 'progress_generation' && (
            <ScreenProgress
              title="Генерация"
              subtitle={`«${(input.target_query as string) ?? ''}»`}
              steps={mapSteps(GENERATION_STEPS, 2)}
              progress={jobState?.progress ?? 15}
              currentStepLabel={formatDuration(genElapsed)}
              onCancel={handleCancel}
            />
          )}

          {screen === 'result' && result && (
            <ScreenResult
              key={activeSessionId ?? jobId ?? 'result'}
              result={result as any}
              query={(input.target_query as string) ?? ''}
              stepCount={9}
              duration={finalDuration ?? duration}
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
