import React, { useRef, useCallback, useState } from 'react';
import type { Track, Playlist, DownloadState } from '../types';
import './TrackList.css';

function formatViews(v?: string): string {
  if (!v) return '';
  const n = parseInt(v);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M vues';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K vues';
  return n + ' vues';
}

// ── TrackMenu ────────────────────────────────────────────────────────────────

interface TrackMenuProps {
  playlists: Playlist[];
  onAdd: (playlistId: string) => void;
  isPlaylist: boolean;
  currentPlaylistID?: string;
  onRemove: () => void;
  onMove: (targetId: string) => void;
}

function TrackMenu({
  playlists,
  onAdd,
  isPlaylist,
  currentPlaylistID,
  onRemove,
  onMove,
}: TrackMenuProps) {
  const [open, setOpen] = useState(false);
  if (!playlists || playlists.length === 0) return null;

  const otherPlaylists = isPlaylist
    ? playlists.filter((pl) => pl.id !== currentPlaylistID)
    : playlists;

  return (
    <div className="pl-menu-wrap">
      <button
        className="action-btn pl-btn"
        title={isPlaylist ? 'Déplacer / retirer' : 'Ajouter à une playlist'}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div className="pl-dropdown" onMouseLeave={() => setOpen(false)}>
          {isPlaylist && otherPlaylists.length > 0 && (
            <>
              <div className="pl-dropdown-label">Déplacer vers</div>
              {otherPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  className="pl-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(pl.id);
                    setOpen(false);
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  {pl.name}
                  <span className="pl-dropdown-count">
                    {(pl.tracks || []).length}
                  </span>
                </button>
              ))}
              <div className="pl-dropdown-sep" />
            </>
          )}

          {isPlaylist && (
            <button
              className="pl-dropdown-item pl-dropdown-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
                setOpen(false);
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Retirer de la playlist
            </button>
          )}

          {!isPlaylist &&
            playlists.map((pl) => (
              <button
                key={pl.id}
                className="pl-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(pl.id);
                  setOpen(false);
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                {pl.name}
                <span className="pl-dropdown-count">
                  {(pl.tracks || []).length}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ── DownloadButton ───────────────────────────────────────────────────────────

interface DownloadButtonProps {
  track: Track;
  downloadStates: Record<string, DownloadState>;
  onDownload: (track: Track) => void;
  onCancelDownload: (track: Track) => void;
}

function DownloadButton({
  track,
  downloadStates,
  onDownload,
  onCancelDownload,
}: DownloadButtonProps) {
  const rawState = downloadStates?.[track.id] || 'idle';
  const state: DownloadState = track.localPath ? 'done' : rawState;

  if (state === 'done')
    return (
      <button
        className="action-btn dl-btn dl-done"
        title="Audio disponible localement"
        disabled
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    );

  if (state === 'downloading')
    return (
      <div className="dl-active-wrap">
        <span className="dl-spinner" />
        <button
          className="action-btn dl-cancel-btn"
          title="Annuler"
          onClick={(e) => {
            e.stopPropagation();
            onCancelDownload(track);
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
      </div>
    );

  if (state === 'cancelling')
    return (
      <button
        className="action-btn dl-btn dl-loading"
        title="Annulation…"
        disabled
      >
        <span className="dl-spinner" />
      </button>
    );

  if (state === 'error')
    return (
      <button
        className="action-btn dl-btn dl-error"
        title="Réessayer"
        onClick={(e) => {
          e.stopPropagation();
          onDownload(track);
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </button>
    );

  return (
    <button
      className="action-btn dl-btn"
      title="Télécharger l'audio"
      onClick={(e) => {
        e.stopPropagation();
        onDownload(track);
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
  );
}

// ── TrackItem ────────────────────────────────────────────────────────────────

interface TrackItemProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: (track: Track, index: number) => void;
  savedIDs?: Set<string>;
  onSaveTrack?: (track: Track) => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  isPlaylist: boolean;
  playlistID?: string;
  onRemoveFromPlaylist?: (playlistId: string, trackId: string) => void;
  downloadStates: Record<string, DownloadState>;
  onDownload: (track: Track) => void;
  onCancelDownload: (track: Track) => void;
}

function TrackItem({
  track,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  savedIDs,
  onSaveTrack,
  playlists,
  onAddToPlaylist,
  isPlaylist,
  playlistID,
  onRemoveFromPlaylist,
  downloadStates,
  onDownload,
  onCancelDownload,
}: TrackItemProps) {
  const isSaved = savedIDs?.has(track.id);

  return (
    <div className={`track-item ${isCurrent ? 'active' : ''}`}>
      <div className="track-index">
        {isCurrent ? (
          isPlaying ? (
            <span className="playing-bars">
              <span />
              <span />
              <span />
            </span>
          ) : (
            <span className="track-paused-icon">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M10 19h4V5h-4z" />
              </svg>
            </span>
          )
        ) : (
          <span className="index-num">{index + 1}</span>
        )}
      </div>

      <div className="track-thumb-wrap" onClick={() => onPlay(track, index)}>
        <img
          src={track.thumbnail}
          alt=""
          className="track-thumb"
          loading="lazy"
        />
        <div className="thumb-overlay">
          {isCurrent && isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>
        {track.localPath && (
          <span className="local-badge" title="Audio local">
            ↓
          </span>
        )}
      </div>

      <div className="track-info" onClick={() => onPlay(track, index)}>
        <p className="track-title">{track.title}</p>
        <p className="track-channel">{track.channel}</p>
      </div>

      <div className="track-meta">
        {track.viewCount && (
          <span className="track-views mono">
            {formatViews(track.viewCount)}
          </span>
        )}
        {track.duration && (
          <span className="track-duration mono">{track.duration}</span>
        )}
      </div>

      <div className="track-actions">
        <DownloadButton
          track={track}
          downloadStates={downloadStates}
          onDownload={onDownload}
          onCancelDownload={onCancelDownload}
        />

        {onSaveTrack && (
          <button
            className={`action-btn save-btn ${isSaved ? 'saved' : ''}`}
            onClick={() => onSaveTrack(track)}
            title={isSaved ? 'Retirer des sauvegardés' : 'Sauvegarder'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={isSaved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}

        <TrackMenu
          playlists={playlists}
          onAdd={(plID) => onAddToPlaylist(plID, track)}
          isPlaylist={isPlaylist}
          currentPlaylistID={playlistID}
          onRemove={() => onRemoveFromPlaylist?.(playlistID!, track.id)}
          onMove={(targetPlID) => {
            onAddToPlaylist(targetPlID, track);
            onRemoveFromPlaylist?.(playlistID!, track.id);
          }}
        />
      </div>
    </div>
  );
}

// ── TrackList ────────────────────────────────────────────────────────────────

interface TrackListProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlay: (track: Track, index: number) => void;
  loading: boolean;
  onLoadMore?: (() => void) | null;
  savedIDs?: Set<string>;
  onSaveTrack?: (track: Track) => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  isPlaylist: boolean;
  playlistID?: string;
  onRemoveFromPlaylist?: (playlistId: string, trackId: string) => void;
  downloadStates: Record<string, DownloadState>;
  onDownload: (track: Track) => void;
  onCancelDownload: (track: Track) => void;
}

export function TrackList({
  tracks,
  currentTrack,
  isPlaying,
  onPlay,
  loading,
  onLoadMore,
  savedIDs,
  onSaveTrack,
  playlists,
  onAddToPlaylist,
  isPlaylist,
  playlistID,
  onRemoveFromPlaylist,
  downloadStates,
  onDownload,
  onCancelDownload,
}: TrackListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!listRef.current || !onLoadMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 200) onLoadMore();
  }, [onLoadMore, loading]);

  if (!loading && tracks.length === 0) {
    return (
      <div className="track-list-empty">
        <div className="empty-icon">♪</div>
        <p>Aucun résultat</p>
      </div>
    );
  }

  return (
    <div className="track-list-wrap" ref={listRef} onScroll={handleScroll}>
      <div className="track-list-header">
        <span>#</span>
        <span></span>
        <span>TITRE</span>
        <span>STATS</span>
        <span></span>
      </div>
      <div className="track-list">
        {tracks.map((track, i) => (
          <TrackItem
            key={`${track.id}-${i}`}
            track={track}
            index={i}
            isCurrent={currentTrack?.id === track.id}
            isPlaying={isPlaying}
            onPlay={onPlay}
            savedIDs={savedIDs}
            onSaveTrack={onSaveTrack}
            playlists={playlists}
            onAddToPlaylist={onAddToPlaylist}
            isPlaylist={isPlaylist}
            playlistID={playlistID}
            onRemoveFromPlaylist={onRemoveFromPlaylist}
            downloadStates={downloadStates}
            onDownload={onDownload}
            onCancelDownload={onCancelDownload}
          />
        ))}
        {loading && (
          <div className="track-list-loading">
            <div className="loading-spinner-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
