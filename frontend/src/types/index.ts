export interface Track {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  localPath?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SearchResult {
  tracks: Track[];
  nextPageToken: string;
  totalResults: number;
}

export type DownloadState = 'idle' | 'downloading' | 'cancelling' | 'done' | 'error';
export type LoopMode = 'none' | 'all' | 'one';
export type ViewMode = 'trending' | 'search' | 'saved' | 'playlist';
