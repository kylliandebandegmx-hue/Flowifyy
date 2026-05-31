package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

type App struct {
	ctx       context.Context
	apiKey    string
	dataDir   string
	audioDir  string
	ytdlpPath string
	audioPort int

	dlMu       sync.Mutex
	dlProcs    map[string]*exec.Cmd // videoID → running yt-dlp process
	streamMu   sync.RWMutex
	streamURLs map[string]string
}

// ─── YouTube API structures ───────────────────────────────────────────────────

type YouTubeSearchResponse struct {
	Items         []SearchItem `json:"items"`
	NextPageToken string       `json:"nextPageToken"`
	PageInfo      PageInfo     `json:"pageInfo"`
}
type PageInfo struct {
	TotalResults   int `json:"totalResults"`
	ResultsPerPage int `json:"resultsPerPage"`
}
type SearchItem struct {
	ID      ItemID      `json:"id"`
	Snippet ItemSnippet `json:"snippet"`
}
type ItemID struct {
	Kind    string `json:"kind"`
	VideoID string `json:"videoId"`
}
type ItemSnippet struct {
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	ChannelTitle string     `json:"channelTitle"`
	PublishedAt  string     `json:"publishedAt"`
	Thumbnails   Thumbnails `json:"thumbnails"`
}
type Thumbnails struct {
	Default  Thumbnail `json:"default"`
	Medium   Thumbnail `json:"medium"`
	High     Thumbnail `json:"high"`
	Standard Thumbnail `json:"standard"`
	Maxres   Thumbnail `json:"maxres"`
}
type Thumbnail struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}
type VideoDetailResponse struct {
	Items []VideoItem `json:"items"`
}
type VideoItem struct {
	ID             string         `json:"id"`
	Snippet        ItemSnippet    `json:"snippet"`
	ContentDetails ContentDetails `json:"contentDetails"`
	Statistics     Statistics     `json:"statistics"`
}
type ContentDetails struct {
	Duration string `json:"duration"`
}
type Statistics struct {
	ViewCount    string `json:"viewCount"`
	LikeCount    string `json:"likeCount"`
	CommentCount string `json:"commentCount"`
}

// ─── Domain types ─────────────────────────────────────────────────────────────

type Track struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Channel     string `json:"channel"`
	Thumbnail   string `json:"thumbnail"`
	Duration    string `json:"duration"`
	ViewCount   string `json:"viewCount"`
	PublishedAt string `json:"publishedAt"`
	Description string `json:"description"`
	LocalPath   string `json:"localPath,omitempty"` // filename in audioDir when downloaded
}
type SearchResult struct {
	Tracks        []Track `json:"tracks"`
	NextPageToken string  `json:"nextPageToken"`
	TotalResults  int     `json:"totalResults"`
}
type Playlist struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Tracks    []Track   `json:"tracks"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	a.dataDir = filepath.Join(home, ".config", "yt-music-player")
	a.audioDir = filepath.Join(a.dataDir, "audio")
	_ = os.MkdirAll(a.dataDir, 0755)
	_ = os.MkdirAll(a.audioDir, 0755)

	if data, err := os.ReadFile(filepath.Join(a.dataDir, "apikey.txt")); err == nil {
		a.apiKey = strings.TrimSpace(string(data))
	}

	a.ytdlpPath = filepath.Join(a.dataDir, ytdlpBinaryName())
	a.dlProcs = make(map[string]*exec.Cmd)
	a.streamURLs = make(map[string]string)
	a.startAudioServer()
}

// startAudioServer launches a local HTTP file server on a random free port.
func (a *App) startAudioServer() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return
	}
	a.audioPort = ln.Addr().(*net.TCPAddr).Port
	mux := http.NewServeMux()
	mux.HandleFunc("/stream/", a.streamHandler)
	mux.Handle("/", http.FileServer(http.Dir(a.audioDir)))
	go http.Serve(ln, corsMiddleware(mux))
}

func corsMiddleware(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Range, Content-Type")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}
func (a *App) getStreamURL(videoID string) (string, error) {
	a.streamMu.RLock()
	urlStr, ok := a.streamURLs[videoID]
	a.streamMu.RUnlock()
	if ok && urlStr != "" {
		return urlStr, nil
	}

	if status := a.EnsureYtdlp(); status != "ready" {
		return "", fmt.Errorf("yt-dlp non disponible: %s", status)
	}

	cmd := newCommand(a.ytdlpPath,
		"--no-playlist",
		"--format",
		"bestaudio[ext=m4a]/bestaudio",
		"--get-url",
		"https://www.youtube.com/watch?v="+videoID,
	)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("yt-dlp get-url échoué: %w", err)
	}
	urlStr = strings.TrimSpace(string(output))
	if urlStr == "" {
		return "", fmt.Errorf("URL de streaming introuvable")
	}

	a.streamMu.Lock()
	a.streamURLs[videoID] = urlStr
	a.streamMu.Unlock()
	return urlStr, nil
}

func (a *App) streamHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	videoID := strings.TrimPrefix(r.URL.Path, "/stream/")
	videoID = strings.Trim(videoID, "/")
	if videoID == "" {
		http.NotFound(w, r)
		return
	}

	remoteURL, err := a.getStreamURL(videoID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, remoteURL, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}
	req.Header.Set("User-Agent", "yt-music-player/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for name, values := range resp.Header {
		if name == "Content-Length" || name == "Content-Type" || name == "Accept-Ranges" || name == "Content-Range" || name == "ETag" || name == "Last-Modified" || name == "Cache-Control" {
			for _, value := range values {
				w.Header().Add(name, value)
			}
		}
	}

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// ─── yt-dlp management ────────────────────────────────────────────────────────

func ytdlpBinaryName() string {
	if runtime.GOOS == "windows" {
		return "yt-dlp.exe"
	}
	return "yt-dlp"
}

func ytdlpDownloadURL() string {
	base := "https://github.com/yt-dlp/yt-dlp/releases/latest/download/"
	switch runtime.GOOS {
	case "windows":
		return base + "yt-dlp.exe"
	case "darwin":
		return base + "yt-dlp_macos"
	default:
		return base + "yt-dlp"
	}
}

// EnsureYtdlp downloads yt-dlp if absent. Returns "ready" or an error message.
func (a *App) EnsureYtdlp() string {
	if _, err := os.Stat(a.ytdlpPath); err == nil {
		return "ready"
	}
	resp, err := http.Get(ytdlpDownloadURL())
	if err != nil {
		return fmt.Sprintf("téléchargement échoué: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Sprintf("téléchargement échoué: HTTP %d", resp.StatusCode)
	}
	f, err := os.OpenFile(a.ytdlpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return fmt.Sprintf("création fichier échouée: %v", err)
	}
	defer f.Close()
	if _, err := io.Copy(f, resp.Body); err != nil {
		return fmt.Sprintf("écriture échouée: %v", err)
	}
	return "ready"
}

// GetAudioPort returns the local HTTP server port used to serve audio files.
func (a *App) GetAudioPort() int {
	return a.audioPort
}

// GetAudioPath returns the filename (relative to audioDir) of a downloaded
// audio file, or "" if it has not been downloaded yet.
func (a *App) GetAudioPath(videoID string) string {
	for _, ext := range []string{".webm", ".opus", ".m4a", ".mp3"} {
		name := videoID + ext
		if _, err := os.Stat(filepath.Join(a.audioDir, name)); err == nil {
			return name
		}
	}
	return ""
}

// DownloadAudio downloads audio for videoID via yt-dlp.
// Returns the filename (relative to audioDir) on success.
// The process is tracked in dlProcs so it can be cancelled via CancelDownload.
func (a *App) DownloadAudio(videoID string) (string, error) {
	if existing := a.GetAudioPath(videoID); existing != "" {
		return existing, nil
	}
	if status := a.EnsureYtdlp(); status != "ready" {
		return "", fmt.Errorf("yt-dlp non disponible: %s", status)
	}

	outTemplate := filepath.Join(a.audioDir, videoID+".%(ext)s")
	ytURL := "https://www.youtube.com/watch?v=" + videoID
	cmd := newCommand(a.ytdlpPath,
		"-x",
		"--audio-quality", "0",
		"--no-playlist",
		"-o", outTemplate,
		ytURL,
	)

	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("démarrage yt-dlp échoué: %w", err)
	}

	a.dlMu.Lock()
	a.dlProcs[videoID] = cmd
	a.dlMu.Unlock()

	err := cmd.Wait()

	a.dlMu.Lock()
	delete(a.dlProcs, videoID)
	a.dlMu.Unlock()

	if err != nil {
		// Clean up any partial file left by yt-dlp
		a.cleanPartials(videoID)
		return "", fmt.Errorf("yt-dlp: %w", err)
	}

	filename := a.GetAudioPath(videoID)
	if filename == "" {
		return "", fmt.Errorf("fichier audio introuvable après téléchargement")
	}
	return filename, nil
}

// CancelDownload kills the yt-dlp process for videoID if it is running.
// Returns true if a process was killed, false if none was found.
func (a *App) CancelDownload(videoID string) bool {
	a.dlMu.Lock()
	cmd, ok := a.dlProcs[videoID]
	if ok {
		delete(a.dlProcs, videoID)
	}
	a.dlMu.Unlock()

	if !ok || cmd.Process == nil {
		return false
	}
	_ = cmd.Process.Kill()
	a.cleanPartials(videoID)
	return true
}

// cleanPartials removes any incomplete yt-dlp output files for videoID.
func (a *App) cleanPartials(videoID string) {
	entries, err := os.ReadDir(a.audioDir)
	if err != nil {
		return
	}
	for _, e := range entries {
		name := e.Name()
		// yt-dlp writes .part files while downloading
		if strings.HasPrefix(name, videoID) {
			_ = os.Remove(filepath.Join(a.audioDir, name))
		}
	}
}

// DeleteAudio removes the downloaded audio file for videoID.
func (a *App) DeleteAudio(videoID string) error {
	filename := a.GetAudioPath(videoID)
	if filename == "" {
		return nil
	}
	return os.Remove(filepath.Join(a.audioDir, filename))
}

// ─── API Key ──────────────────────────────────────────────────────────────────

func (a *App) SetAPIKey(key string) string {
	a.apiKey = key
	params := url.Values{}
	params.Set("part", "id")
	params.Set("chart", "mostPopular")
	params.Set("maxResults", "1")
	params.Set("key", key)
	resp, err := http.Get("https://www.googleapis.com/youtube/v3/videos?" + params.Encode())
	if err != nil || resp.StatusCode != 200 {
		a.apiKey = ""
		return "invalid"
	}
	resp.Body.Close()
	_ = os.WriteFile(filepath.Join(a.dataDir, "apikey.txt"), []byte(key), 0600)
	return "valid"
}

func (a *App) HasAPIKey() bool { return a.apiKey != "" }

// ─── Search ───────────────────────────────────────────────────────────────────

func (a *App) SearchMusic(query string, pageToken string, maxResults int) (*SearchResult, error) {
	if a.apiKey == "" {
		return nil, fmt.Errorf("API key not set")
	}
	if maxResults <= 0 {
		maxResults = 20
	}
	params := url.Values{}
	params.Set("part", "snippet")
	params.Set("q", query)
	params.Set("type", "video")
	params.Set("videoCategoryId", "10")
	params.Set("maxResults", fmt.Sprintf("%d", maxResults))
	params.Set("key", a.apiKey)
	params.Set("order", "relevance")
	if pageToken != "" {
		params.Set("pageToken", pageToken)
	}
	resp, err := http.Get("https://www.googleapis.com/youtube/v3/search?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	var searchResp YouTubeSearchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("parse failed: %w", err)
	}
	ids := make([]string, 0, len(searchResp.Items))
	for _, item := range searchResp.Items {
		if item.ID.VideoID != "" {
			ids = append(ids, item.ID.VideoID)
		}
	}
	details := make(map[string]VideoItem)
	if len(ids) > 0 {
		if m, err := a.getVideoDetails(ids); err == nil {
			details = m
		}
	}
	tracks := make([]Track, 0, len(searchResp.Items))
	for _, item := range searchResp.Items {
		if item.ID.VideoID == "" {
			continue
		}
		t := trackFromSnippet(item.ID.VideoID, item.Snippet)
		if d, ok := details[item.ID.VideoID]; ok {
			t.Duration = parseDuration(d.ContentDetails.Duration)
			t.ViewCount = d.Statistics.ViewCount
		}
		t.LocalPath = a.GetAudioPath(t.ID)
		tracks = append(tracks, t)
	}
	return &SearchResult{
		Tracks:        tracks,
		NextPageToken: searchResp.NextPageToken,
		TotalResults:  searchResp.PageInfo.TotalResults,
	}, nil
}

func (a *App) GetVideoByURL(rawURL string) (*SearchResult, error) {
	if a.apiKey == "" {
		return nil, fmt.Errorf("API key not set")
	}
	videoID, playlistID := parseYouTubeURL(rawURL)
	if playlistID != "" {
		return a.getPlaylistItems(playlistID)
	}
	if videoID != "" {
		return a.getSingleVideo(videoID)
	}
	return nil, fmt.Errorf("URL YouTube non reconnue")
}

func (a *App) getSingleVideo(videoID string) (*SearchResult, error) {
	details, err := a.getVideoDetails([]string{videoID})
	if err != nil {
		return nil, err
	}
	item, ok := details[videoID]
	if !ok {
		return nil, fmt.Errorf("vidéo introuvable: %s", videoID)
	}
	t := Track{
		ID:          item.ID,
		Title:       item.Snippet.Title,
		Channel:     item.Snippet.ChannelTitle,
		Thumbnail:   bestThumb(item.Snippet.Thumbnails),
		Duration:    parseDuration(item.ContentDetails.Duration),
		ViewCount:   item.Statistics.ViewCount,
		PublishedAt: item.Snippet.PublishedAt,
		Description: item.Snippet.Description,
		LocalPath:   a.GetAudioPath(videoID),
	}
	return &SearchResult{Tracks: []Track{t}, TotalResults: 1}, nil
}

func (a *App) getPlaylistItems(playlistID string) (*SearchResult, error) {
	params := url.Values{}
	params.Set("part", "snippet")
	params.Set("playlistId", playlistID)
	params.Set("maxResults", "50")
	params.Set("key", a.apiKey)
	resp, err := http.Get("https://www.googleapis.com/youtube/v3/playlistItems?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	type PLItemSnippet struct {
		Title        string     `json:"title"`
		ChannelTitle string     `json:"channelTitle"`
		PublishedAt  string     `json:"publishedAt"`
		Thumbnails   Thumbnails `json:"thumbnails"`
		ResourceID   struct {
			VideoID string `json:"videoId"`
		} `json:"resourceId"`
	}
	type PLItem struct {
		Snippet PLItemSnippet `json:"snippet"`
	}
	type PLResp struct {
		Items []PLItem `json:"items"`
	}
	var plResp PLResp
	if err := json.Unmarshal(body, &plResp); err != nil {
		return nil, fmt.Errorf("parse failed: %w", err)
	}
	ids := make([]string, 0, len(plResp.Items))
	snippMap := make(map[string]PLItemSnippet)
	for _, item := range plResp.Items {
		id := item.Snippet.ResourceID.VideoID
		if id != "" {
			ids = append(ids, id)
			snippMap[id] = item.Snippet
		}
	}
	details := make(map[string]VideoItem)
	if len(ids) > 0 {
		if m, err := a.getVideoDetails(ids); err == nil {
			details = m
		}
	}
	tracks := make([]Track, 0, len(ids))
	for _, id := range ids {
		s := snippMap[id]
		t := Track{
			ID:          id,
			Title:       s.Title,
			Channel:     s.ChannelTitle,
			Thumbnail:   bestThumb(s.Thumbnails),
			PublishedAt: s.PublishedAt,
			LocalPath:   a.GetAudioPath(id),
		}
		if d, ok := details[id]; ok {
			t.Duration = parseDuration(d.ContentDetails.Duration)
			t.ViewCount = d.Statistics.ViewCount
		}
		tracks = append(tracks, t)
	}
	return &SearchResult{Tracks: tracks, TotalResults: len(tracks)}, nil
}

func (a *App) GetTrending() (*SearchResult, error) {
	if a.apiKey == "" {
		return nil, fmt.Errorf("API key not set")
	}
	params := url.Values{}
	params.Set("part", "snippet,contentDetails,statistics")
	params.Set("chart", "mostPopular")
	params.Set("videoCategoryId", "10")
	params.Set("maxResults", "20")
	params.Set("key", a.apiKey)
	params.Set("regionCode", "FR")
	resp, err := http.Get("https://www.googleapis.com/youtube/v3/videos?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	var videoResp VideoDetailResponse
	if err := json.Unmarshal(body, &videoResp); err != nil {
		return nil, err
	}
	tracks := make([]Track, 0, len(videoResp.Items))
	for _, item := range videoResp.Items {
		tracks = append(tracks, Track{
			ID:          item.ID,
			Title:       item.Snippet.Title,
			Channel:     item.Snippet.ChannelTitle,
			Thumbnail:   bestThumb(item.Snippet.Thumbnails),
			Duration:    parseDuration(item.ContentDetails.Duration),
			ViewCount:   item.Statistics.ViewCount,
			PublishedAt: item.Snippet.PublishedAt,
			Description: item.Snippet.Description,
			LocalPath:   a.GetAudioPath(item.ID),
		})
	}
	return &SearchResult{Tracks: tracks, TotalResults: len(tracks)}, nil
}

// ─── Playlists ────────────────────────────────────────────────────────────────

func (a *App) playlistsPath() string { return filepath.Join(a.dataDir, "playlists.json") }

func (a *App) loadPlaylists() ([]Playlist, error) {
	data, err := os.ReadFile(a.playlistsPath())
	if os.IsNotExist(err) {
		return []Playlist{}, nil
	}
	if err != nil {
		return nil, err
	}
	var pls []Playlist
	return pls, json.Unmarshal(data, &pls)
}

func (a *App) savePlaylists(pls []Playlist) error {
	data, err := json.MarshalIndent(pls, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.playlistsPath(), data, 0644)
}

func (a *App) GetPlaylists() ([]Playlist, error) { return a.loadPlaylists() }

func (a *App) CreatePlaylist(name string) (*Playlist, error) {
	if strings.TrimSpace(name) == "" {
		return nil, fmt.Errorf("nom vide")
	}
	pls, err := a.loadPlaylists()
	if err != nil {
		return nil, err
	}
	pl := Playlist{
		ID:        fmt.Sprintf("%d", time.Now().UnixMilli()),
		Name:      strings.TrimSpace(name),
		Tracks:    []Track{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	pls = append(pls, pl)
	return &pl, a.savePlaylists(pls)
}

func (a *App) RenamePlaylist(id, name string) error {
	pls, err := a.loadPlaylists()
	if err != nil {
		return err
	}
	for i, pl := range pls {
		if pl.ID == id {
			pls[i].Name = strings.TrimSpace(name)
			pls[i].UpdatedAt = time.Now()
			return a.savePlaylists(pls)
		}
	}
	return fmt.Errorf("playlist introuvable: %s", id)
}

func (a *App) DeletePlaylist(id string) error {
	pls, err := a.loadPlaylists()
	if err != nil {
		return err
	}
	out := pls[:0]
	for _, pl := range pls {
		if pl.ID != id {
			out = append(out, pl)
		}
	}
	return a.savePlaylists(out)
}

func (a *App) AddTrackToPlaylist(playlistID string, track Track) error {
	pls, err := a.loadPlaylists()
	if err != nil {
		return err
	}
	for i, pl := range pls {
		if pl.ID == playlistID {
			for _, t := range pl.Tracks {
				if t.ID == track.ID {
					return nil
				}
			}
			pls[i].Tracks = append(pls[i].Tracks, track)
			pls[i].UpdatedAt = time.Now()
			return a.savePlaylists(pls)
		}
	}
	return fmt.Errorf("playlist introuvable: %s", playlistID)
}

func (a *App) RemoveTrackFromPlaylist(playlistID, trackID string) error {
	pls, err := a.loadPlaylists()
	if err != nil {
		return err
	}
	for i, pl := range pls {
		if pl.ID == playlistID {
			out := pl.Tracks[:0]
			for _, t := range pl.Tracks {
				if t.ID != trackID {
					out = append(out, t)
				}
			}
			pls[i].Tracks = out
			pls[i].UpdatedAt = time.Now()
			return a.savePlaylists(pls)
		}
	}
	return fmt.Errorf("playlist introuvable: %s", playlistID)
}

func (a *App) ReorderPlaylistTrack(playlistID string, fromIndex, toIndex int) error {
	pls, err := a.loadPlaylists()
	if err != nil {
		return err
	}
	for i, pl := range pls {
		if pl.ID == playlistID {
			n := len(pl.Tracks)
			if fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n {
				return fmt.Errorf("index hors limites")
			}
			track := pl.Tracks[fromIndex]
			tmp := append(pl.Tracks[:fromIndex:fromIndex], pl.Tracks[fromIndex+1:]...)
			out := make([]Track, 0, n)
			out = append(out, tmp[:toIndex]...)
			out = append(out, track)
			out = append(out, tmp[toIndex:]...)
			pls[i].Tracks = out
			pls[i].UpdatedAt = time.Now()
			return a.savePlaylists(pls)
		}
	}
	return fmt.Errorf("playlist introuvable: %s", playlistID)
}

// ─── Saved tracks ─────────────────────────────────────────────────────────────

func (a *App) savedPath() string { return filepath.Join(a.dataDir, "saved.json") }

func (a *App) GetSavedTracks() ([]Track, error) {
	data, err := os.ReadFile(a.savedPath())
	if os.IsNotExist(err) {
		return []Track{}, nil
	}
	if err != nil {
		return nil, err
	}
	var tracks []Track
	return tracks, json.Unmarshal(data, &tracks)
}

func (a *App) SaveTrack(track Track) error {
	tracks, err := a.GetSavedTracks()
	if err != nil {
		return err
	}
	for _, t := range tracks {
		if t.ID == track.ID {
			return nil
		}
	}
	tracks = append(tracks, track)
	data, err := json.MarshalIndent(tracks, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.savedPath(), data, 0644)
}

func (a *App) UnsaveTrack(trackID string) error {
	tracks, err := a.GetSavedTracks()
	if err != nil {
		return err
	}
	out := tracks[:0]
	for _, t := range tracks {
		if t.ID != trackID {
			out = append(out, t)
		}
	}
	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.savedPath(), data, 0644)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (a *App) getVideoDetails(videoIDs []string) (map[string]VideoItem, error) {
	if len(videoIDs) == 0 {
		return nil, nil
	}
	params := url.Values{}
	params.Set("part", "snippet,contentDetails,statistics")
	params.Set("id", strings.Join(videoIDs, ","))
	params.Set("key", a.apiKey)
	resp, err := http.Get("https://www.googleapis.com/youtube/v3/videos?" + params.Encode())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var detailResp VideoDetailResponse
	if err := json.Unmarshal(body, &detailResp); err != nil {
		return nil, err
	}
	result := make(map[string]VideoItem, len(detailResp.Items))
	for _, item := range detailResp.Items {
		result[item.ID] = item
	}
	return result, nil
}

var (
	reVideoID    = regexp.MustCompile(`(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})`)
	rePlaylistID = regexp.MustCompile(`[?&]list=([A-Za-z0-9_-]+)`)
)

func parseYouTubeURL(rawURL string) (videoID, playlistID string) {
	if m := reVideoID.FindStringSubmatch(rawURL); len(m) > 1 {
		videoID = m[1]
	}
	if m := rePlaylistID.FindStringSubmatch(rawURL); len(m) > 1 {
		playlistID = m[1]
	}
	return
}

func trackFromSnippet(id string, s ItemSnippet) Track {
	return Track{
		ID:          id,
		Title:       s.Title,
		Channel:     s.ChannelTitle,
		Thumbnail:   bestThumb(s.Thumbnails),
		PublishedAt: s.PublishedAt,
		Description: s.Description,
	}
}

func bestThumb(t Thumbnails) string {
	if t.High.URL != "" {
		return t.High.URL
	}
	if t.Medium.URL != "" {
		return t.Medium.URL
	}
	return t.Default.URL
}

func parseDuration(iso string) string {
	if iso == "" || iso == "P0D" {
		return ""
	}
	var hours, minutes, seconds int
	i, num := 2, 0
	for i < len(iso) {
		c := iso[i]
		if c >= '0' && c <= '9' {
			num = num*10 + int(c-'0')
		} else if c == 'H' {
			hours = num
			num = 0
		} else if c == 'M' {
			minutes = num
			num = 0
		} else if c == 'S' {
			seconds = num
			num = 0
		}
		i++
	}
	if hours > 0 {
		return fmt.Sprintf("%d:%02d:%02d", hours, minutes, seconds)
	}
	return fmt.Sprintf("%d:%02d", minutes, seconds)
}
