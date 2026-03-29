import { useState, useCallback, useRef } from 'react';

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: Date;
  state: unknown;
  thumbnail?: string;
}

export function useStudioHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const counter = useRef(0);

  const pushState = useCallback((label: string, state: unknown, thumbnail?: string) => {
    const entry: HistoryEntry = {
      id: `history-${++counter.current}`,
      label,
      timestamp: new Date(),
      state,
      thumbnail,
    };

    setEntries(prev => {
      // Discard any forward history when pushing a new state
      const truncated = prev.slice(0, currentIndex + 1);
      return [...truncated, entry];
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex <= 0) return null;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return entries[newIndex]?.state ?? null;
  }, [currentIndex, entries]);

  const redo = useCallback(() => {
    if (currentIndex >= entries.length - 1) return null;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return entries[newIndex]?.state ?? null;
  }, [currentIndex, entries]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < entries.length - 1;

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= entries.length) return null;
    setCurrentIndex(index);
    return entries[index]?.state ?? null;
  }, [entries]);

  return {
    entries, currentIndex, canUndo, canRedo,
    pushState, undo, redo, goTo,
  };
}
