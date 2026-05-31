# 🎵 YouTube Music Player — Wails + React

Un lecteur de musique YouTube élégant construit avec Wails (Go) et React.

---

## ✨ Fonctionnalités

- 🔍 **Recherche** de musique via YouTube Data API v3
- 🔥 **Tendances** musicales (catégorie Music, région FR)
- ▶️ **Lecture** de vidéos YouTube en arrière-plan (audio uniquement visible)
- ⏯️ **Contrôles** : play/pause, suivant, précédent, seek
- 🔁 **Modes de répétition** : aucun / tout / un
- 🔀 **Lecture aléatoire**
- 📋 **File d'attente** : ajout de titres, suppression
- 🔉 **Volume** ajustable avec sourdine
- 📊 **Infos vidéo** : vues, durée, chaîne

---

## 🚀 Installation

### Prérequis

1. **Go** ≥ 1.21 — https://go.dev/dl/
2. **Node.js** ≥ 18 — https://nodejs.org/
3. **Wails CLI** :
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```
4. **Dépendances système** (Linux uniquement) :
   ```bash
   # Ubuntu/Debian
   sudo apt-get install libgtk-3-dev libwebkit2gtk-4.0-dev
   ```

### Clé API YouTube

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un projet (ou en sélectionner un existant)
3. **APIs & Services** → **Bibliothèque** → chercher **YouTube Data API v3** → Activer
4. **APIs & Services** → **Identifiants** → **+ Créer des identifiants** → **Clé API**
5. Copier la clé → la coller au démarrage de l'application

---

## 🛠️ Développement

```bash
# Installer les dépendances frontend
cd frontend && npm install && cd ..

# Lancer en mode développement
wails dev
```

## 📦 Build (application native)

```bash
wails build
```

L'exécutable se trouve dans `build/bin/`.

---

## 📁 Structure du projet

```
youtube-player/
├── main.go              # Point d'entrée Wails
├── app.go               # Logique backend Go (YouTube API)
├── wails.json           # Configuration Wails
├── go.mod               # Dépendances Go
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx           # Composant principal + état
        ├── App.css
        ├── index.css         # Variables CSS globales
        ├── wailsjs.js        # Bindings Wails → Go
        └── components/
            ├── APIKeySetup.jsx   # Écran de saisie clé API
            ├── Sidebar.jsx       # Navigation + recherche
            ├── TrackList.jsx     # Liste des pistes
            ├── Player.jsx        # Lecteur bas de page
            └── NowPlaying.jsx    # Info piste en cours
```

---

## 🔑 API YouTube utilisée

| Endpoint | Usage |
|----------|-------|
| `search.list` | Recherche de vidéos musicales |
| `videos.list` | Durée + statistiques |
| `videos.list?chart=mostPopular` | Tendances musique FR |

La clé API est stockée en mémoire (non persistée) — à saisir à chaque démarrage.

---

## 🎨 Design

- **Palette** : dark avec accent rouge/rose (`#ff3d6b`)
- **Typographie** : Syne (UI) + DM Mono (chiffres)
- **Lecteur** : YouTube IFrame API intégrée en arrière-plan
