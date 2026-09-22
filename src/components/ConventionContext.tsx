'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Convention } from '@/lib/domain';

interface ConventionCtx {
  convention: Convention;
  setConvention: (c: Convention) => void;
  toggle: () => void;
}

const Ctx = createContext<ConventionCtx | null>(null);

export function ConventionProvider({ children }: { children: ReactNode }) {
  const [convention, setConvention] = useState<Convention>('display');
  const toggle = useCallback(() => {
    setConvention((c) => (c === 'display' ? 'raw' : 'display'));
  }, []);
  const value = useMemo(
    () => ({ convention, setConvention, toggle }),
    [convention, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConvention(): ConventionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useConvention must be used within ConventionProvider');
  }
  return ctx;
}
