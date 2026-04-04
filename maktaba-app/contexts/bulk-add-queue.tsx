import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { OpenLibraryBook } from '@/middleware';

export type PendingBookItem = { id: string; book: OpenLibraryBook };

function newQueueItemId() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type BulkAddQueueValue = {
  items: PendingBookItem[];
  queueSize: number;
  addBook: (book: OpenLibraryBook) => { ok: true } | { ok: false; reason: 'duplicate' };
  removeItem: (id: string) => void;
  clear: () => void;
};

const BulkAddQueueContext = createContext<BulkAddQueueValue | null>(null);

export function BulkAddQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<PendingBookItem[]>([]);

  const addBook = useCallback((book: OpenLibraryBook) => {
    let duplicate = false;
    setItems((prev) => {
      if (prev.some((p) => p.book.isbn === book.isbn)) {
        duplicate = true;
        return prev;
      }
      return [...prev, { id: newQueueItemId(), book }];
    });
    return duplicate ? { ok: false as const, reason: 'duplicate' as const } : { ok: true as const };
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({
      items,
      queueSize: items.length,
      addBook,
      removeItem,
      clear,
    }),
    [items, addBook, removeItem, clear]
  );

  return <BulkAddQueueContext.Provider value={value}>{children}</BulkAddQueueContext.Provider>;
}

export function useBulkAddQueue() {
  const ctx = useContext(BulkAddQueueContext);
  if (!ctx) {
    throw new Error('useBulkAddQueue must be used within BulkAddQueueProvider');
  }
  return ctx;
}
