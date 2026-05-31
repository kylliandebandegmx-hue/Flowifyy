import React, { useState } from 'react';
import { wails } from '../lib/wails';
import './APIKeySetup.css';

interface APIKeySetupProps {
  onKeySet: () => void;
}

export function APIKeySetup({ onKeySet }: APIKeySetupProps) {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!key.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await wails.SetAPIKey(key.trim());
      if (result === 'valid') {
        onKeySet();
      } else {
        setStatus('error');
        setErrorMsg(
          'Clé API invalide. Vérifiez votre clé YouTube Data API v3.',
        );
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('Erreur de connexion: ' + String(err));
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-bg" />
      <div className="setup-card">
        <div className="setup-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect
              width="48"
              height="48"
              rx="14"
              fill="var(--accent)"
              opacity="0.15"
            />
            <path d="M20 16L36 24L20 32V16Z" fill="var(--accent)" />
          </svg>
        </div>
        <h1 className="setup-title">YouTube Music</h1>
        <p className="setup-subtitle">
          Entrez votre clé API YouTube Data v3 pour commencer
        </p>

        <form className="setup-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Clé API Google / YouTube</label>
            <input
              className="api-input"
              type="password"
              placeholder="AIza..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={status === 'loading'}
              autoFocus
            />
          </div>

          {status === 'error' && <div className="setup-error">{errorMsg}</div>}

          <button
            className="setup-btn"
            type="submit"
            disabled={!key.trim() || status === 'loading'}
          >
            {status === 'loading' ? (
              <span className="btn-loading">
                <span className="spinner-sm" />
                Vérification...
              </span>
            ) : (
              'Démarrer →'
            )}
          </button>
        </form>

        <div className="setup-help">
          <p>
            Obtenez une clé gratuite sur{' '}
            <a
              href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Cloud Console
            </a>{' '}
            → YouTube Data API v3
          </p>
          <ol>
            <li>Créer un projet</li>
            <li>Activer YouTube Data API v3</li>
            <li>Créer des identifiants → Clé API</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
