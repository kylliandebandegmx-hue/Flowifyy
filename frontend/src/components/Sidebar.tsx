import React, { useState } from 'react';
import type { Track, Playlist, ViewMode } from '../types';
import './Sidebar.css';

interface SidebarProps {
  view: ViewMode;
  onTrending: () => void;
  onSaved: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: (q: string) => void;
  currentTrack: Track | null;
  playlists: Playlist[];
  onOpenPlaylist: (pl: Playlist) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  activePlaylistId?: string;
  savedCount: number;
}

export function Sidebar({
  view,
  onTrending,
  onSaved,
  query,
  onQueryChange,
  onSearch,
  currentTrack,
  playlists,
  onOpenPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  activePlaylistId,
  savedCount,
}: SidebarProps) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setShowNewInput(false);
  };

  const startRename = (pl: Playlist, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(pl.id);
    setRenameValue(pl.name);
  };

  const commitRename = (id: string) => {
    if (renameValue.trim()) onRenamePlaylist(id, renameValue.trim());
    setRenamingId(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect
            width="28"
            height="28"
            rx="8"
            fill="var(--accent)"
            opacity="0.15"
          />
          <path d="M11 9L21 14L11 19V9Z" fill="var(--accent)" />
        </svg>
        <span className="logo-text">YT Music</span>
      </div>

      <form className="search-form" onSubmit={handleSearchSubmit}>
        <div className="search-input-wrap">
          <svg
            className="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Chercher ou coller une URL…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <button className="search-btn" type="submit" disabled={!query.trim()}>
          →
        </button>
      </form>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${view === 'trending' ? 'active' : ''}`}
          onClick={onTrending}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          Tendances
        </button>

        <button
          className={`nav-item ${view === 'saved' ? 'active' : ''}`}
          onClick={onSaved}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Sauvegardés
          {savedCount > 0 && <span className="queue-badge">{savedCount}</span>}
        </button>
      </nav>

      <div className="sidebar-section">
        <div className="section-header">
          <span className="section-label">PLAYLISTS</span>
          <button
            className="icon-btn"
            title="Nouvelle playlist"
            onClick={() => setShowNewInput((v) => !v)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {showNewInput && (
          <form className="new-playlist-form" onSubmit={handleCreate}>
            <input
              autoFocus
              className="new-playlist-input"
              placeholder="Nom de la playlist…"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setShowNewInput(false)}
            />
            <button
              type="submit"
              className="new-playlist-ok"
              disabled={!newPlaylistName.trim()}
            >
              ✓
            </button>
          </form>
        )}

        <div className="playlist-list">
          {(playlists || []).map((pl) => (
            <div
              key={pl.id}
              className={`playlist-item ${activePlaylistId === pl.id ? 'active' : ''}`}
              onClick={() => onOpenPlaylist(pl)}
            >
              {renamingId === pl.id ? (
                <input
                  autoFocus
                  className="rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(pl.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(pl.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="pl-icon"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span className="pl-name">{pl.name}</span>
                  <span className="pl-count">{(pl.tracks || []).length}</span>
                  <div className="pl-actions">
                    <button
                      className="icon-btn-sm"
                      title="Renommer"
                      onClick={(e) => startRename(pl, e)}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="icon-btn-sm danger"
                      title="Supprimer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlaylist(pl.id);
                      }}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {(playlists || []).length === 0 && (
            <p className="pl-empty">Aucune playlist</p>
          )}
        </div>
      </div>

      {/*currentTrack && (
        <div className="sidebar-now-playing">
          <p className="now-label">EN COURS</p>
          <div className="now-info">
            <img src={currentTrack.thumbnail} alt="" className="now-thumb" />
            <div className="now-text">
              <p className="now-title">{currentTrack.title}</p>
              <p className="now-channel">{currentTrack.channel}</p>
            </div>
          </div>
        </div>
      )}*/}

      <div className="sidebar-footer">
        <p className="footer-text">
          <button
            className="footer-button"
            title="Nouvelle playlist"
            onClick={() => setShowNewInput((v) => !v)}
          >
            Nouvelle playlist
          </button>
        </p>
      </div>
    </aside>
  );
}
