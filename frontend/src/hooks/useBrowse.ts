import { useState, useCallback } from 'react';
import { wails } from '../lib/wails';
import type { Track, ViewMode } from '../types';

export function useBrowse() {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nextPageToken, setNextPageToken] = useState('');
  const [view, setView] = useState<ViewMode>('trending');

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    if (q.includes('youtu')) {
      setLoading(true);
      setError('');
      setView('search');
      try {
        const result = await wails.GetVideoByURL(q);
        setTracks(result.tracks || []);
        setNextPageToken('');
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError('');
    setView('search');
    try {
      const result = await wails.SearchMusic(q, '', 20);
      setTracks(result.tracks || []);
      setNextPageToken(result.nextPageToken || '');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (currentQuery: string, token: string) => {
    if (!token || loading) return;
    setLoading(true);
    try {
      const result = await wails.SearchMusic(currentQuery, token, 20);
      setTracks((prev) => [...prev, ...(result.tracks || [])]);
      setNextPageToken(result.nextPageToken || '');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    setError('');
    setView('trending');
    try {
      const result = await wails.GetTrending();
      setTracks(result.tracks || []);
      setNextPageToken('');
    } catch (err) {
      setError(String(err));
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    query, setQuery,
    tracks, setTracks,
    loading,
    error, setError,
    nextPageToken,
    view, setView,
    handleSearch,
    loadMore,
    loadTrending,
  };
}
