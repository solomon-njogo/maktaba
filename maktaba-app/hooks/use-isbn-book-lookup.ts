import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { addBook } from '@/lib/db/books';
import { validateIsbnCandidate } from '@/lib/isbn';
import { fetchBookByIsbn, type OpenLibraryBook } from '@/lib/openlibrary';

function prefetchCoverIfNeeded(coverUrl?: string | null) {
  const uri = typeof coverUrl === 'string' ? coverUrl.trim() : '';
  if (!uri) return;
  if (!uri.startsWith('http://') && !uri.startsWith('https://')) return;

  void Image.prefetch(uri, { cachePolicy: 'memory-disk' });
}

export function useIsbnBookLookup() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const [isbnInput, setIsbnInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OpenLibraryBook | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function runLookup(
    isbnCandidate: string,
    options?: { onFound?: (book: OpenLibraryBook) => void }
  ) {
    const v = validateIsbnCandidate(isbnCandidate);
    if (!v.ok) {
      setLookupError(
        v.reason === 'empty'
          ? 'Please enter an ISBN.'
          : v.reason === 'too_short'
            ? 'That ISBN looks too short.'
            : v.reason === 'invalid_checksum'
              ? 'That ISBN checksum is invalid.'
              : 'Please enter a valid ISBN-10 or ISBN-13.'
      );
      setPreview(null);
      return;
    }

    setLookupError(null);
    setLookupLoading(true);
    setPreview(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const book = await fetchBookByIsbn(v.normalized, { signal: controller.signal });
      if (!book) {
        setLookupError('No results found for that ISBN.');
        setPreview(null);
        return;
      }
      prefetchCoverIfNeeded(book.coverUrl);
      setPreview(book);
      setIsbnInput(v.normalized);
      setLookupLoading(false);
      options?.onFound?.(book);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lookup failed';
      setLookupError(msg.startsWith('OpenLibraryError:') ? 'OpenLibrary lookup failed. Try again.' : msg);
      setPreview(null);
    } finally {
      setLookupLoading(false);
    }
  }

  async function savePreview() {
    if (!preview) return;
    const id =
      typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `book_${Date.now()}`;

    try {
      await addBook({
        id,
        isbn: preview.isbn,
        title: preview.subtitle ? `${preview.title}: ${preview.subtitle}` : preview.title,
        author: preview.authors?.length ? preview.authors.join(', ') : null,
        pages: preview.numberOfPages ?? null,
        description: preview.description ?? null,
        genre: preview.genre ?? null,
        coverUri: preview.coverUrl ?? null,
        status: 'tbr',
      });

      Alert.alert('Saved', 'Book added to your library.');
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('constraint')) {
        Alert.alert('Already added', 'This ISBN is already in your library.');
        return;
      }
      Alert.alert('Could not save', msg);
    }
  }

  function resetLookup() {
    setLookupError(null);
    setPreview(null);
  }

  return {
    isbnInput,
    setIsbnInput,
    lookupLoading,
    lookupError,
    preview,
    setPreview,
    runLookup,
    savePreview,
    resetLookup,
  };
}
