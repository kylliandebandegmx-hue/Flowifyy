import { useState, useCallback } from 'react';
import { wails } from '../lib/wails';
import type { Track, Playlist } from '../types';

export function usePlaylists(
  enrichTracksWithLocalPath: (tracks: Track[]) => Promise<Track[]>,
) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);

  const loadPlaylists = useCallback(async () => {
    const pls = await wails.GetPlaylists();
    if (!pls) { setPlaylists([]); return; }
    const enriched = await Promise.all(
      pls.map(async (pl) => ({ ...pl, tracks: await enrichTracksWithLocalPath(pl.tracks || []) })),
    );
    setPlaylists(enriched);
  }, [enrichTracksWithLocalPath]);

  const handleCreatePlaylist = useCallback(async (name: string) => {
    const pl = await wails.CreatePlaylist(name);
    setPlaylists((prev) => [...prev, pl]);
  }, []);

  const handleDeletePlaylist = useCallback(async (id: string) => {
    await wails.DeletePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (activePlaylist?.id === id) setActivePlaylist(null);
    return id;
  }, [activePlaylist]);

  const handleRenamePlaylist = useCallback(async (id: string, name: string) => {
    await wails.RenamePlaylist(id, name);
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    if (activePlaylist?.id === id) setActivePlaylist((prev) => prev ? { ...prev, name } : prev);
  }, [activePlaylist]);

  const handleAddToPlaylist = useCallback(async (playlistID: string, track: Track) => {
    await wails.AddTrackToPlaylist(playlistID, track);
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistID
          ? { ...p, tracks: [...(p.tracks || []).filter((t) => t.id !== track.id), track] }
          : p,
      ),
    );
    if (activePlaylist?.id === playlistID) {
      setActivePlaylist((prev) =>
        prev ? { ...prev, tracks: [...(prev.tracks || []).filter((t) => t.id !== track.id), track] } : prev,
      );
    }
  }, [activePlaylist]);

  const handleRemoveFromPlaylist = useCallback(async (playlistID: string, trackID: string) => {
    await wails.RemoveTrackFromPlaylist(playlistID, trackID);
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistID ? { ...p, tracks: (p.tracks || []).filter((t) => t.id !== trackID) } : p,
      ),
    );
    if (activePlaylist?.id === playlistID) {
      setActivePlaylist((prev) =>
        prev ? { ...prev, tracks: (prev.tracks || []).filter((t) => t.id !== trackID) } : prev,
      );
    }
  }, [activePlaylist]);

  const openPlaylist = useCallback(async (pl: Playlist) => {
    const enrichedTracks = await enrichTracksWithLocalPath(pl.tracks || []);
    const enriched = { ...pl, tracks: enrichedTracks };
    setActivePlaylist(enriched);
    return enriched;
  }, [enrichTracksWithLocalPath]);

  const patchTrack = useCallback((id: string, localPath: string) => {
    const patch = (t: Track) => (t.id === id ? { ...t, localPath } : t);
    setPlaylists((prev) => prev.map((pl) => ({ ...pl, tracks: pl.tracks.map(patch) })));
    setActivePlaylist((prev) => (prev ? { ...prev, tracks: prev.tracks.map(patch) } : prev));
  }, []);

  return {
    playlists,
    activePlaylist, setActivePlaylist,
    loadPlaylists,
    handleCreatePlaylist,
    handleDeletePlaylist,
    handleRenamePlaylist,
    handleAddToPlaylist,
    handleRemoveFromPlaylist,
    openPlaylist,
    patchTrack,
  };
}
