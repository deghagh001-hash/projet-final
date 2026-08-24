# YouTube to MP4 Converter

Application web Flask + React pour convertir des vidéos YouTube, TikTok, Instagram et Twitch en MP4 ou MP3.

## 🚀 Fonctionnalités

- ✅ Conversion vidéo (MP4 1080p, 720p, 480p)
- ✅ Conversion audio (MP3 128k, 320k, WAV)
- ✅ Support multi-plateformes (YouTube, TikTok, Instagram, Twitch)
- ✅ Barre de progression en temps réel (Server-Sent Events)
- ✅ Limite quotidienne (8 conversions/jour par IP, persistée dans SQLite)
- ✅ Nettoyage automatique des fichiers (10 minutes)
- ✅ Easter Eggs cachés (Matrix, Silent Hill, etc.)
- ✅ Interface React moderne avec Tailwind CSS
- ✅ Sécurité renforcée (CSP, validation URL)

## 📋 Prérequis

- Python 3.8+
- Node.js 18+ et npm
- FFmpeg (pour conversions audio et vidéos haute qualité)

### Installation FFmpeg

**Windows:**

1. Télécharger depuis https://ffmpeg.org/download.html
2. Extraire et ajouter au PATH système

**Linux/Mac:**

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

## 🛠️ Installation

### 1. Backend (Flask)

```bash
cd projet
pip install -r requirements.txt
```

### 2. Frontend (React - Optionnel)

```bash
cd frontend
npm install
npm run build
```

Le build sera généré dans `static/react_build/`

## 🎯 Utilisation

### Mode Développement

```bash
python app.py
```

Le serveur démarre sur `http://127.0.0.1:5000`.

Le mode debug Flask est désactivé par défaut (la console Werkzeug permet l'exécution de code à distance).
Pour l'activer en local uniquement :

```bash
FLASK_DEBUG=1 python app.py
```

Variables d'environnement disponibles : `HOST` (défaut `127.0.0.1`), `PORT` (défaut `5000`), `FLASK_DEBUG` (défaut `0`), `TRUST_PROXY` (défaut `1` : lecture de `X-Forwarded-For` via `ProxyFix`, à mettre à `0` si l'application n'est pas derrière un proxy de confiance).

Les compteurs de rate limiting sont stockés dans `usage.db` (SQLite, créé automatiquement au démarrage).

### Versions disponibles

- **Version classique** : `http://127.0.0.1:5000/`
- **Version React (in-browser Babel)** : `http://127.0.0.1:5000/react`
- **Version React (compilée)** : `http://127.0.0.1:5000/react-app`

## 🚢 Déploiement Production

⚠️ **NE PAS utiliser le serveur Flask intégré en production !**

### Option 1: Waitress (Windows)

```bash
pip install waitress
waitress-serve --port=5000 app:app
```

### Option 2: Gunicorn (Linux/Mac)

```bash
pip install gunicorn gevent
gunicorn -k gevent -w 1 -b 0.0.0.0:5000 app:app
```

### Option 3: Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn gevent

# Installer FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY . .

EXPOSE 5000
CMD ["gunicorn", "-k", "gevent", "-w", "1", "-b", "0.0.0.0:5000", "app:app"]
```

## 🎨 Easter Eggs

Tapez ces commandes dans le champ URL pour déclencher des effets spéciaux :

- `matrix` - Effet Matrix (pluie de code)
- `silent hill` - Ambiance Silent Hill (brouillard + son)
- `hack` - Simulation de piratage
- `123 viva l'algerie` - Drapeau algérien animé
- `pes 6` - Nostalgie PES 6

Accédez à la page secrète : `http://127.0.0.1:5000/react-app` puis cliquez sur "Secrets 🤫"

## 🔒 Sécurité

### Mesures implémentées

- ✅ Content Security Policy (CSP) + `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- ✅ Validation stricte des URLs (schéma http(s) + domaine exact via liste blanche)
- ✅ Validation du format demandé (liste blanche)
- ✅ Messages d'erreur génériques côté client (détails uniquement dans les logs serveur)
- ✅ Mode debug désactivé par défaut
- ✅ Rate limiting (8 conversions/jour/IP, compteurs persistés dans `usage.db`, purge quotidienne)
- ✅ Vérification de la taille des fichiers téléchargés
- ✅ Nettoyage automatique des fichiers temporaires
- ✅ Domaines autorisés uniquement (YouTube, TikTok, Instagram, Twitch)

### Limitations connues

- ⚠️ yt-dlp peut parfois générer des fichiers invalides sous Windows
- ⚠️ Les threads Flask peuvent bloquer avec yt-dlp (utiliser Gunicorn/Waitress en prod)
- ⚠️ Babel in-browser est lent (utiliser la version compilée `/react-app`)
- ⚠️ Le rate limiting utilise `ProxyFix` (`x_for=1`) : ne déployer qu'avec un reverse proxy de confiance, sinon un client peut forger `X-Forwarded-For` (désactivable avec `TRUST_PROXY=0`)
- ⚠️ Les fichiers de `downloads/` sont servis sans authentification : quiconque connaît le nom du fichier peut le récupérer avant son nettoyage automatique
- ⚠️ La CSP autorise encore `unsafe-eval` sur `/react` (Babel in-browser) et `unsafe-inline` sur `/` (scripts inline JSON-LD/analytics) ; les autres routes, dont `/react-app`, sont en `script-src 'self'`

## 📁 Structure du projet

```
projet/
├── app.py                  # Backend Flask
├── requirements.txt        # Dépendances Python
├── usage.db                # Compteurs de rate limiting (SQLite, auto-créé)
├── downloads/              # Fichiers téléchargés (auto-nettoyés)
├── static/
│   ├── css/               # Styles
│   ├── js/                # JavaScript vanilla
│   ├── audio/             # Sons pour Easter Eggs
│   ├── video/             # Vidéo de fond
│   └── react_build/       # Build React (généré)
├── templates/
│   ├── index.html         # Version classique
│   ├── react_index.html   # Version React (Babel)
│   └── easter-eggs.html   # Page Easter Eggs statique
└── frontend/              # Projet React/Vite
    ├── src/
    │   ├── App.jsx        # Composant principal
    │   ├── main.jsx       # Point d'entrée
    │   └── index.css      # Styles Tailwind
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

## 🐛 Dépannage

### "FFmpeg not found"

- Installer FFmpeg et l'ajouter au PATH
- Redémarrer le terminal après installation

### "npm not recognized"

- Installer Node.js depuis https://nodejs.org
- Redémarrer le terminal
- Vérifier avec `node --version` et `npm --version`

### Vidéo de fond noire

- Vérifier que `static/video/background.mp4` existe
- Rafraîchir la page avec Ctrl+F5 (vider le cache)
- Vérifier la console du navigateur (F12)

### Erreur "Daily limit reached"

- Attendre le lendemain (reset à minuit)
- Ou vider localStorage : `localStorage.clear()` dans la console

## 📝 Licence

GPLv3 - voir le fichier LICENSE

## 👨‍💻 Développement

### Lancer le frontend en mode dev (avec hot reload)

```bash
cd frontend
npm run dev
```

Accéder à `http://localhost:5173` (nécessite un proxy vers Flask pour l'API)

### Compiler le frontend

```bash
cd frontend
npm run build
```

Les fichiers seront générés dans `../static/react_build/`

---

**Fait avec ❤️ par l'équipe youtubetomp4**
