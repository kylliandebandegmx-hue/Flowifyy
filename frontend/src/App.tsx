import React, { useEffect, useCallback } from 'react';
import { wails } from './lib/wails';
import { usePlayer } from './hooks/usePlayer';
import { useBrowse } from './hooks/useBrowse';
import { usePlaylists } from './hooks/usePlaylists';
import { useSavedTracks } from './hooks/useSavedTracks';
import { useDownload } from './hooks/useDownload';
import { APIKeySetup } from './components/APIKeySetup';
import { Sidebar } from './components/Sidebar';
import { TrackList } from './components/TrackList';
import { Player } from './components/Player';
import type { Track } from './types';
import { useState } from 'react';
import './App.css';

export default function App() {
  const [apiKeySet, setApiKeySet] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);

  // ── Hooks ──────────────────────────────────────────────────────────────────

  const player = usePlayer();

  const browse = useBrowse();

  const enrichTracksWithLocalPath = useCallback(async (tracks: Track[]) => {
    if (!tracks?.length) return tracks;
    return Promise.all(
      tracks.map(async (track) => {
        if (track.localPath) return track;
        const localPath = await wails.GetAudioPath(track.id);
        return localPath ? { ...track, localPath } : track;
      }),
    );
  }, []);

  const playlists = usePlaylists(enrichTracksWithLocalPath);
  const saved = useSavedTracks(enrichTracksWithLocalPath);

  const download = useDownload([
    // Patch tracks in every relevant state location
    (id, localPath) => {
      browse.setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, localPath } : t)),
      );
      player.setQueue((prev) =>
        prev.map((t) => (t.id === id ? { ...t, localPath } : t)),
      );
      player.setCurrentTrack((prev) =>
        prev?.id === id ? { ...prev, localPath } : prev,
      );
      playlists.patchTrack(id, localPath);
      saved.patchTrack(id, localPath);
    },
  ]);

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    wails.HasAPIKey().then((has) => {
      setApiKeySet(has);
      setCheckingKey(false);
    });
  }, []);

  useEffect(() => {
    if (apiKeySet) {
      browse.loadTrending();
      playlists.loadPlaylists();
      saved.loadSaved();
      wails.GetAudioPort().then((port) => player.setAudioPort(port));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeySet]);

  // ── Track selection ────────────────────────────────────────────────────────

  const handleTrackSelection = useCallback(
    (track: Track, list: Track[], index: number) => {
      if (player.currentTrack?.id === track.id) {
        player.togglePlay();
        return;
      }
      player.playTrack(track, list, index);
    },
    [player],
  );

  // ── Playlist open ──────────────────────────────────────────────────────────

  const handleOpenPlaylist = useCallback(
    async (pl: { id: string; name: string; tracks: Track[] }) => {
      const enriched = await playlists.openPlaylist(pl);
      browse.setView('playlist');
      browse.setTracks(enriched.tracks);
    },
    [playlists, browse],
  );

  const handleDeletePlaylist = useCallback(
    async (id: string) => {
      await playlists.handleDeletePlaylist(id);
      if (playlists.activePlaylist?.id === id) {
        browse.setView('trending');
        browse.loadTrending();
      }
    },
    [playlists, browse],
  );

  const showSaved = useCallback(() => {
    browse.setView('saved');
    browse.setTracks(saved.savedTracks);
  }, [browse, saved.savedTracks]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const displayTracks =
    browse.view === 'saved'
      ? saved.savedTracks
      : browse.view === 'playlist'
        ? playlists.activePlaylist?.tracks || []
        : browse.tracks;

  const viewTitle = () => {
    if (browse.view === 'trending') return 'Tendances';
    if (browse.view === 'search') return `Résultats pour "${browse.query}"`;
    if (browse.view === 'saved') return 'Titres sauvegardés';
    if (browse.view === 'playlist')
      return `${playlists.activePlaylist?.name || 'Playlist'}`;
    return '';
  };

  const error = player.error || browse.error;
  const clearError = () => {
    player.setError('');
    browse.setError('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (checkingKey) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!apiKeySet) {
    return <APIKeySetup onKeySet={() => setApiKeySet(true)} />;
  }

  return (
    <div className="app">
      <Sidebar
        view={browse.view}
        onTrending={browse.loadTrending}
        onSaved={showSaved}
        query={browse.query}
        onQueryChange={browse.setQuery}
        onSearch={browse.handleSearch}
        currentTrack={player.currentTrack}
        playlists={playlists.playlists}
        onOpenPlaylist={handleOpenPlaylist}
        onCreatePlaylist={playlists.handleCreatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onRenamePlaylist={playlists.handleRenamePlaylist}
        activePlaylistId={playlists.activePlaylist?.id}
        savedCount={saved.savedIDs.size}
      />

      <main className="main-content">
        <div className="content-header">
          <h1 className="view-title">{viewTitle()}</h1>
          {(browse.view === 'search' ||
            browse.view === 'playlist' ||
            browse.view === 'saved') &&
            displayTracks.length > 0 && (
              <span className="result-count mono">
                {displayTracks.length} titres
              </span>
            )}
        </div>

        {error && (
          <div className="error-banner" onClick={clearError}>
            {error}
            <button className="error-close">✕</button>
          </div>
        )}

        <TrackList
          tracks={displayTracks}
          currentTrack={player.currentTrack}
          isPlaying={player.isPlaying}
          onPlay={(track, index) => {
            const list =
              browse.view === 'playlist'
                ? playlists.activePlaylist?.tracks || []
                : displayTracks;
            handleTrackSelection(track, list, index);
          }}
          loading={browse.loading}
          onLoadMore={
            browse.nextPageToken &&
            (browse.view === 'search' || browse.view === 'trending')
              ? () => browse.loadMore(browse.query, browse.nextPageToken)
              : null
          }
          savedIDs={saved.savedIDs}
          onSaveTrack={saved.handleSaveTrack}
          playlists={playlists.playlists}
          onAddToPlaylist={playlists.handleAddToPlaylist}
          isPlaylist={browse.view === 'playlist'}
          playlistID={playlists.activePlaylist?.id}
          onRemoveFromPlaylist={playlists.handleRemoveFromPlaylist}
          downloadStates={download.downloadStates}
          onDownload={download.handleDownload}
          onCancelDownload={download.handleCancelDownload}
        />
      </main>

      <Player
        track={player.currentTrack}
        isPlaying={player.isPlaying}
        onTogglePlay={player.togglePlay}
        onNext={player.handleNext}
        onPrev={player.handlePrev}
        volume={player.volume}
        isMuted={player.isMuted}
        onVolumeChange={player.handleVolumeChange}
        onToggleMute={player.toggleMute}
        loopMode={player.loopMode}
        onCycleLoop={player.cycleLoop}
        shuffle={player.shuffle}
        onToggleShuffle={player.toggleShuffle}
        currentTime={player.currentTime}
        duration={player.duration}
        onSeek={player.handleSeek}
        queue={player.queue}
        queueIndex={player.queueIndex}
      />
    </div>
  );
}
