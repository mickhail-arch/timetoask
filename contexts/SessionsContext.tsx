//contexts/SessionsContext.tsx

'use client';

import { createContext, useContext, useReducer, useCallback, useMemo, useEffect, ReactNode } from 'react';

export type SessionScreen = 'input' | 'progress_analysis' | 'brief' | 'progress_generation' | 'result';

export interface JobStateSnapshot {
  jobId: string;
  status: 'processing' | 'awaiting_confirmation' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  stepName: string;
  progress: number;
  partialData?: string;
  brief?: Record<string, unknown>;
  competitorMeta?: Array<{ url: string; metaTitle: string; metaDescription: string; slug: string }>;
  result?: Record<string, unknown>;
  error?: string;
  calculatedPrice?: number;
  warnings?: string[];
}

export interface SessionState {
  sessionId: string;
  screen: SessionScreen;
  jobId: string | null;
  input: Record<string, unknown>;
  brief: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  calculatedPrice: number;
  startTime: number;
  submitError: string | null;
  savedImages: Record<string, unknown> | null;
  jobState: JobStateSnapshot | null;
  // serverStatus отражает реальный статус сессии в БД (для подсчёта «активных»)
  serverStatus: 'draft' | 'generating' | 'awaiting_confirmation' | 'completed' | 'failed';
  confirming: boolean;
}

interface ManagerState {
  sessions: Record<string, SessionState>;
  activeSessionId: string | null;
  draftSessionId: string | null;
  capacityModalOpen: boolean;
}

const MAX_ACTIVE_GENERATIONS = 5;

type Action =
  | { type: 'SET_ACTIVE'; sessionId: string | null }
  | { type: 'SET_DRAFT'; sessionId: string | null }
  | { type: 'CREATE_SESSION'; sessionId: string; initial: Partial<SessionState> }
  | { type: 'UPDATE_SESSION'; sessionId: string; patch: Partial<SessionState> }
  | { type: 'REMOVE_SESSION'; sessionId: string }
  | { type: 'SET_JOB_STATE'; sessionId: string; jobState: JobStateSnapshot | null }
  | { type: 'OPEN_CAPACITY_MODAL' }
  | { type: 'CLOSE_CAPACITY_MODAL' };

function createDefaultSession(sessionId: string, partial: Partial<SessionState> = {}): SessionState {
  return {
    sessionId,
    screen: 'input',
    jobId: null,
    input: {},
    brief: null,
    result: null,
    calculatedPrice: 0,
    startTime: 0,
    submitError: null,
    savedImages: null,
    jobState: null,
    serverStatus: 'draft',
    confirming: false,
    ...partial,
  };
}

function reducer(state: ManagerState, action: Action): ManagerState {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, activeSessionId: action.sessionId };

    case 'SET_DRAFT':
      return { ...state, draftSessionId: action.sessionId };

    case 'CREATE_SESSION': {
      if (state.sessions[action.sessionId]) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.sessionId]: createDefaultSession(action.sessionId, action.initial),
        },
      };
    }

    case 'UPDATE_SESSION': {
      const existing = state.sessions[action.sessionId];
      if (!existing) {
        // Создать если не существует
        return {
          ...state,
          sessions: {
            ...state.sessions,
            [action.sessionId]: createDefaultSession(action.sessionId, action.patch),
          },
        };
      }
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.sessionId]: { ...existing, ...action.patch },
        },
      };
    }

    case 'REMOVE_SESSION': {
      const next = { ...state.sessions };
      delete next[action.sessionId];
      return {
        ...state,
        sessions: next,
        activeSessionId: state.activeSessionId === action.sessionId ? null : state.activeSessionId,
        draftSessionId: state.draftSessionId === action.sessionId ? null : state.draftSessionId,
      };
    }

    case 'SET_JOB_STATE': {
      const existing = state.sessions[action.sessionId];
      if (!existing) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.sessionId]: { ...existing, jobState: action.jobState },
        },
      };
    }

    case 'OPEN_CAPACITY_MODAL':
      return { ...state, capacityModalOpen: true };

    case 'CLOSE_CAPACITY_MODAL':
      return { ...state, capacityModalOpen: false };

    default:
      return state;
  }
}

interface ContextValue {
  state: ManagerState;
  activeCount: number;
  canStartNewGeneration: boolean;
  setActive: (sessionId: string | null) => void;
  setDraft: (sessionId: string | null) => void;
  createSession: (sessionId: string, initial?: Partial<SessionState>) => void;
  updateSession: (sessionId: string, patch: Partial<SessionState>) => void;
  removeSession: (sessionId: string) => void;
  setJobState: (sessionId: string, jobState: JobStateSnapshot | null) => void;
  getSession: (sessionId: string) => SessionState | null;
  upsertSession: (sessionId: string, patch: Partial<SessionState>) => void;
  tryStartGeneration: () => boolean; // true если можно стартовать, false если 5/5 (показывает модалку)
  closeCapacityModal: () => void;
  getActiveSessionIds: () => string[];
}

const SessionsContext = createContext<ContextValue | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    sessions: {},
    activeSessionId: null,
    draftSessionId: null,
    capacityModalOpen: false,
  });

  const activeSessionIds = useMemo(
    () =>
      Object.values(state.sessions)
        .filter(s => s.serverStatus === 'generating' || s.serverStatus === 'awaiting_confirmation')
        .map(s => s.sessionId),
    [state.sessions],
  );

  const activeCount = activeSessionIds.length;
  const canStartNewGeneration = activeCount < MAX_ACTIVE_GENERATIONS;

  const setActive = useCallback((id: string | null) => dispatch({ type: 'SET_ACTIVE', sessionId: id }), []);
  const setDraft = useCallback((id: string | null) => dispatch({ type: 'SET_DRAFT', sessionId: id }), []);
  const createSession = useCallback((id: string, initial: Partial<SessionState> = {}) =>
    dispatch({ type: 'CREATE_SESSION', sessionId: id, initial }), []);
  const updateSession = useCallback((id: string, patch: Partial<SessionState>) =>
    dispatch({ type: 'UPDATE_SESSION', sessionId: id, patch }), []);
  const removeSession = useCallback((id: string) => dispatch({ type: 'REMOVE_SESSION', sessionId: id }), []);
  const setJobState = useCallback((id: string, jobState: JobStateSnapshot | null) =>
    dispatch({ type: 'SET_JOB_STATE', sessionId: id, jobState }), []);

  const getSession = useCallback(
    (id: string) => state.sessions[id] ?? null,
    [state.sessions],
  );
  const upsertSession = useCallback(
    (id: string, patch: Partial<SessionState>) =>
      dispatch({ type: 'UPDATE_SESSION', sessionId: id, patch }),
    [],
  );

  const tryStartGeneration = useCallback(() => {
    if (activeCount >= MAX_ACTIVE_GENERATIONS) {
      dispatch({ type: 'OPEN_CAPACITY_MODAL' });
      return false;
    }
    return true;
  }, [activeCount]);

  const closeCapacityModal = useCallback(() => dispatch({ type: 'CLOSE_CAPACITY_MODAL' }), []);
  const getActiveSessionIds = useCallback(() => activeSessionIds, [activeSessionIds]);

  const value = useMemo<ContextValue>(() => ({
    state,
    activeCount,
    canStartNewGeneration,
    setActive,
    setDraft,
    createSession,
    updateSession,
    removeSession,
    setJobState,
    getSession,
    upsertSession,
    tryStartGeneration,
    closeCapacityModal,
    getActiveSessionIds,
  }), [state, activeCount, canStartNewGeneration, setActive, setDraft, createSession, updateSession, removeSession, setJobState, getSession, upsertSession, tryStartGeneration, closeCapacityModal, getActiveSessionIds]);

  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}

interface HydratorProps {
  sessions: Array<{
    id: string;
    status: string;
    outputMeta: Record<string, unknown> | null;
  }>;
}

export function SessionsHydrator({ sessions }: HydratorProps) {
  const { state, upsertSession } = useSessions();

  useEffect(() => {
    for (const s of sessions) {
      const existing = state.sessions[s.id];
      const meta = (s.outputMeta ?? {}) as Record<string, unknown>;
      const storedJobId = (meta.jobId as string | undefined) ?? null;
      const serverStatus = s.status as SessionState['serverStatus'];

      if (!existing) {
        // Создаём запись только для активных, чтобы не раздувать стейт
        if (serverStatus === 'generating' || serverStatus === 'awaiting_confirmation') {
          upsertSession(s.id, {
            sessionId: s.id,
            jobId: storedJobId,
            serverStatus,
            screen: serverStatus === 'awaiting_confirmation' ? 'brief' : 'progress_analysis',
          });
        }
        continue;
      }

      // Обновляем serverStatus и jobId если изменились
      if (existing.serverStatus !== serverStatus) {
        upsertSession(s.id, { serverStatus });
      }
      if (storedJobId && existing.jobId !== storedJobId) {
        upsertSession(s.id, { jobId: storedJobId });
      }
    }
  }, [sessions, state.sessions, upsertSession]);

  return null;
}

export function useSessions(): ContextValue {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error('useSessions must be used within SessionsProvider');
  return ctx;
}

export { MAX_ACTIVE_GENERATIONS };
