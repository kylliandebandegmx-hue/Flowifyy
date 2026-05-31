import type { Track, Playlist, SearchResult } from '../types';

// ─── Storage helpers (localStorage) ──────────────────────────────────────────
function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── YouTube API (called directly from browser) ───────────────────────────────
let _apiKey = localStorage.getItem('yt_api_key') || '';

async function ytFetch(endpoint: string, params: Record<string, string | number>): Promise<unknown> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.searchParams.set('key', _apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message || `YouTube API ${res.status}`);
  }
  return res.json();
}

function bestThumb(t: { default?: { url: string }; medium?: { url: string }; high?: { url: string }; maxres?: { url: string } }): string {
  return t.high?.url || t.medium?.url || t.default?.url || '';
}

function parseDuration(iso: string): string {
  if (!iso || iso === 'P0D') return '';
  let h = 0, m = 0, s = 0, num = 0;
  for (let i = 2; i < iso.length; i++) {
    const c = iso[i];
    if (c >= '0' && c <= '9') { num = num * 10 + parseInt(c); }
    else if (c === 'H') { h = num; num = 0; }
    else if (c === 'M') { m = num; num = 0; }
    else if (c === 'S') { s = num; num = 0; }
  }
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

type YTSnippet = { title: string; channelTitle: string; thumbnails: Record<string, { url: string }>; publishedAt: string; description: string };
type YTItem = { id: string | { videoId: string }; snippet: YTSnippet; contentDetails?: { duration: string }; statistics?: { viewCount: string } };

function toTrack(item: YTItem): Track {
  const id = typeof item.id === 'string' ? item.id : item.id.videoId;
  return {
    id,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: bestThumb(item.snippet.thumbnails),
    duration: item.contentDetails ? parseDuration(item.contentDetails.duration) : '',
    viewCount: item.statistics?.viewCount,
    publishedAt: item.snippet.publishedAt,
  };
}

// ─── wails API — same interface as original, now runs in browser ──────────────
export const wails = {
  // ── Key management ──────────────────────────────────────────────────────────
  HasAPIKey: async (): Promise<boolean> => {
    return !!localStorage.getItem('yt_api_key');
  },

  SetAPIKey: async (key: string): Promise<string> => {
    const prev = _apiKey;
    _apiKey = key.trim();
    try {
      await ytFetch('videos', { part: 'id', chart: 'mostPopular', maxResults: 1, videoCategoryId: '10' });
      localStorage.setItem('yt_api_key', _apiKey);
      return 'valid';
    } catch {
      _apiKey = prev;
      return 'invalid';
    }
  },

  // ── Search ──────────────────────────────────────────────────────────────────
  SearchMusic: async (query: string, pageToken = '', maxResults = 20): Promise<SearchResult> => {
    const data = await ytFetch('search', {
      part: 'snippet', q: query, type: 'video', videoCategoryId: '10',
      maxResults, order: 'relevance', ...(pageToken ? { pageToken } : {}),
    }) as { items: YTItem[]; nextPageToken?: string; pageInfo: { totalResults: number } };
    const ids = data.items.map((i: YTItem) => (typeof i.id === 'string' ? i.id : i.id.videoId)).filter(Boolean);
    let details: Record<string, YTItem> = {};
    if (ids.length) {
      const d = await ytFetch('videos', { part: 'contentDetails,statistics', id: ids.join(',') }) as { items: YTItem[] };
      for (const item of d.items) details[item.id as string] = item;
    }
    return {
      tracks: data.items.map((item: YTItem) => {
        const t = toTrack(item);
        const vid = typeof item.id === 'string' ? item.id : item.id.videoId;
        if (details[vid]) {
          t.duration = parseDuration(details[vid].contentDetails!.duration);
          t.viewCount = details[vid].statistics?.viewCount;
        }
        return t;
      }),
      nextPageToken: data.nextPageToken || '',
      totalResults: data.pageInfo.totalResults,
    };
  },

  GetVideoByURL: async (rawUrl: string): Promise<SearchResult> => {
    const matchV = rawUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    const matchPL = rawUrl.match(/[?&]list=([A-Za-z0-9_-]+)/);
    if (matchPL) {
      const data = await ytFetch('playlistItems', { part: 'snippet', playlistId: matchPL[1], maxResults: 50 }) as { items: YTItem[] };
      const tracks = data.items.map((i: YTItem) => toTrack(i));
      return { tracks, nextPageToken: '', totalResults: tracks.length };
    }
    if (matchV) {
      const data = await ytFetch('videos', { part: 'snippet,contentDetails,statistics', id: matchV[1] }) as { items: YTItem[] };
      return { tracks: data.items.map(toTrack), nextPageToken: '', totalResults: data.items.length };
    }
    throw new Error('URL YouTube non reconnue');
  },

  GetTrending: async (): Promise<SearchResult> => {
    const data = await ytFetch('videos', {
      part: 'snippet,contentDetails,statistics', chart: 'mostPopular',
      videoCategoryId: '10', maxResults: 20, regionCode: 'FR',
    }) as { items: YTItem[] };
    return { tracks: data.items.map(toTrack), nextPageToken: '', totalResults: data.items.length };
  },

  // ── Audio (no yt-dlp on GitHub Pages → port = 0, IFrame API handles audio) ─
  GetAudioPort: async (): Promise<number> => 0,
  GetAudioPath: async (_id: string): Promise<string> => '',
  EnsureYtdlp: async (): Promise<string> => 'ok',
  DownloadAudio: async (_id: string): Promise<string> => '',
  CancelDownload: async (_id: string): Promise<boolean> => false,
  DeleteAudio: async (_id: string): Promise<void> => {},

  // ── Playlists (localStorage) ─────────────────────────────────────────────────
  GetPlaylists: async (): Promise<Playlist[]> => lsGet<Playlist[]>('flowify_playlists', []),
  CreatePlaylist: async (name: string): Promise<Playlist> => {
    const pls = lsGet<Playlist[]>('flowify_playlists', []);
    const pl: Playlist = { id: String(Date.now()), name: name.trim(), tracks: [] };
    lsSet('flowify_playlists', [...pls, pl]);
    return pl;
  },
  RenamePlaylist: async (id: string, name: string): Promise<void> => {
    lsSet('flowify_playlists', lsGet<Playlist[]>('flowify_playlists', []).map(p => p.id === id ? { ...p, name } : p));
  },
  DeletePlaylist: async (id: string): Promise<void> => {
    lsSet('flowify_playlists', lsGet<Playlist[]>('flowify_playlists', []).filter(p => p.id !== id));
  },
  AddTrackToPlaylist: async (playlistID: string, track: Track): Promise<void> => {
    lsSet('flowify_playlists', lsGet<Playlist[]>('flowify_playlists', []).map(p =>
      p.id === playlistID && !p.tracks.find(t => t.id === track.id)
        ? { ...p, tracks: [...p.tracks, track] } : p
    ));
  },
  RemoveTrackFromPlaylist: async (playlistID: string, trackID: string): Promise<void> => {
    lsSet('flowify_playlists', lsGet<Playlist[]>('flowify_playlists', []).map(p =>
      p.id === playlistID ? { ...p, tracks: p.tracks.filter(t => t.id !== trackID) } : p
    ));
  },
  ReorderPlaylistTrack: async (playlistID: string, from: number, to: number): Promise<void> => {
    lsSet('flowify_playlists', lsGet<Playlist[]>('flowify_playlists', []).map(p => {
      if (p.id !== playlistID) return p;
      const tracks = [...p.tracks];
      const [item] = tracks.splice(from, 1);
      tracks.splice(to, 0, item);
      return { ...p, tracks };
    }));
  },

  // ── Saved tracks (localStorage) ───────────────────────────────────────────
  GetSavedTracks: async (): Promise<Track[]> => lsGet<Track[]>('flowify_saved', []),
  SaveTrack: async (track: Track): Promise<void> => {
    const saved = lsGet<Track[]>('flowify_saved', []);
    if (!saved.find(t => t.id === track.id)) lsSet('flowify_saved', [...saved, track]);
  },
  UnsaveTrack: async (trackID: string): Promise<void> => {
    lsSet('flowify_saved', lsGet<Track[]>('flowify_saved', []).filter(t => t.id !== trackID));
  },
};
