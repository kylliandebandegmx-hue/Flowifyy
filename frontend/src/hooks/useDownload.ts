import { useState, useCallback } from 'react';
import { wails } from '../lib/wails';
import type { Track, DownloadState } from '../types';

interface PatchFn {
  (id: string, localPath: string): void;
}

export function useDownload(patches: PatchFn[]) {
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});

  const handleDownload = useCallback(async (track: Track): Promise<string | null> => {
    if (downloadStates[track.id] === 'downloading') return null;
    setDownloadStates((prev) => ({ ...prev, [track.id]: 'downloading' }));
    try {
      const filename = await wails.DownloadAudio(track.id);
      patches.forEach((patch) => patch(track.id, filename));
      setDownloadStates((prev) => ({ ...prev, [track.id]: 'done' }));
      return filename;
    } catch (err) {
      setDownloadStates((prev) => {
        if (prev[track.id] === 'cancelling') return { ...prev, [track.id]: 'idle' };
        return { ...prev, [track.id]: 'error' };
      });
      return null;
    }
  }, [downloadStates, patches]);

  const handleCancelDownload = useCallback(async (track: Track) => {
    setDownloadStates((prev) => ({ ...prev, [track.id]: 'cancelling' }));
    await wails.CancelDownload(track.id);
  }, []);

  return { downloadStates, handleDownload, handleCancelDownload };
}
