import { useState, useCallback } from 'react';
import { wails } from '../lib/wails';
import type { Track } from '../types';

export function useSavedTracks(
  enrichTracksWithLocalPath: (tracks: Track[]) => Promise<Track[]>,
) {
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [savedIDs, setSavedIDs] = useState<Set<string>>(new Set());

  const loadSaved = useCallback(async () => {
    const saved = await wails.GetSavedTracks();
    const enriched = await enrichTracksWithLocalPath(saved || []);
    setSavedTracks(enriched);
    setSavedIDs(new Set((enriched || []).map((t) => t.id)));
  }, [enrichTracksWithLocalPath]);

  const handleSaveTrack = useCallback(async (track: Track) => {
    if (savedIDs.has(track.id)) {
      await wails.UnsaveTrack(track.id);
      setSavedIDs((prev) => { const s = new Set(prev); s.delete(track.id); return s; });
      setSavedTracks((prev) => prev.filter((t) => t.id !== track.id));
    } else {
      await wails.SaveTrack(track);
      setSavedIDs((prev) => new Set([...prev, track.id]));
      setSavedTracks((prev) => [...prev, track]);
    }
  }, [savedIDs]);

  const patchTrack = useCallback((id: string, localPath: string) => {
    setSavedTracks((prev) => prev.map((t) => (t.id === id ? { ...t, localPath } : t)));
  }, []);

  return { savedTracks, savedIDs, loadSaved, handleSaveTrack, patchTrack };
}
