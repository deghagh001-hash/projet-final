from flask import Flask, render_template, request, jsonify, send_from_directory, Response, stream_with_context
from werkzeug.exceptions import HTTPException, NotFound
from werkzeug.middleware.proxy_fix import ProxyFix
import yt_dlp
import logging
import os
import sqlite3
import time
import threading
import shutil
import queue
from contextlib import closing
from datetime import datetime

from converter import (
    build_ydl_opts,
    is_supported_format,
    is_supported_url,
    resolve_final_filename,
    sse_error,
    sse_event,
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# request.remote_addr renvoie l'IP du proxy quand l'application est servie derrière
# un reverse proxy : ProxyFix lit le dernier saut de X-Forwarded-For pour retrouver
# l'IP réelle du client, indispensable au rate limiting par IP.
# À n'activer que derrière un proxy de confiance : sans proxy, un client peut forger
# X-Forwarded-For et contourner la limite quotidienne.
if os.environ.get('TRUST_PROXY', '1').lower() in ('1', 'true', 'yes'):
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)

DOWNLOAD_FOLDER = 'downloads'

# 1. Vérification de FFmpeg
if not shutil.which('ffmpeg'):
    logger.warning(
        "FFmpeg n'est pas installe ou n'est pas dans le PATH systeme. "
        "Les conversions MP3 et les vidéos haute qualite (1080p+) pourraient echouer."
    )
else:
    logger.info("FFmpeg detecte.")

# Assurer que le dossier de téléchargement existe.
# Une erreur ici est fatale : l'application ne peut rien convertir sans ce dossier.
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# 2. Système de Rate Limiting (Limitation par IP)
# Compteurs persistés dans SQLite : ils survivent aux redémarrages et sont partagés
# entre les workers WSGI, contrairement à un dictionnaire en mémoire.
USAGE_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usage.db')
usage_lock = threading.Lock()
DAILY_LIMIT = 8

def _usage_connection():
    """Ouvre une connexion dédiée à l'appel courant (une connexion par thread)."""
    return sqlite3.connect(USAGE_DB, timeout=10)

def init_usage_db():
    with usage_lock, closing(_usage_connection()) as conn:
        with conn:
            conn.execute(
                'CREATE TABLE IF NOT EXISTS usage ('
                '  ip TEXT NOT NULL,'
                '  date TEXT NOT NULL,'
                '  count INTEGER NOT NULL DEFAULT 0,'
                '  PRIMARY KEY (ip, date)'
                ')'
            )

def check_rate_limit(ip_address):
    today = datetime.now().strftime('%Y-%m-%d')

    with usage_lock, closing(_usage_connection()) as conn:
        row = conn.execute(
            'SELECT count FROM usage WHERE ip = ? AND date = ?',
            (ip_address, today),
        ).fetchone()

    return (row[0] if row else 0) < DAILY_LIMIT

def increment_usage(ip_address):
    today = datetime.now().strftime('%Y-%m-%d')

    with usage_lock, closing(_usage_connection()) as conn:
        with conn:
            conn.execute(
                'INSERT INTO usage (ip, date, count) VALUES (?, ?, 1) '
                'ON CONFLICT(ip, date) DO UPDATE SET count = count + 1',
                (ip_address, today),
            )

def purge_old_usage():
    """Supprime les compteurs des jours précédents pour borner la taille de la base."""
    today = datetime.now().strftime('%Y-%m-%d')

    with usage_lock, closing(_usage_connection()) as conn:
        with conn:
            deleted = conn.execute('DELETE FROM usage WHERE date != ?', (today,)).rowcount

    if deleted:
        logger.info("Purged %d stale rate limit entries", deleted)

init_usage_db()

def cleanup_old_files():
    """Thread d'arrière-plan pour supprimer les fichiers vieux de plus de 10 minutes."""
    while True:
        try:
            current_time = time.time()
            if os.path.exists(DOWNLOAD_FOLDER):
                for filename in os.listdir(DOWNLOAD_FOLDER):
                    if filename.startswith('.'):
                        continue
                    file_path = os.path.join(DOWNLOAD_FOLDER, filename)
                    if os.path.isfile(file_path):
                        file_age = current_time - os.path.getmtime(file_path)
                        if file_age > 600:  # 10 minutes
                            try:
                                os.remove(file_path)
                                logger.info("Deleted old file: %s", filename)
                            except OSError:
                                logger.exception("Error deleting %s", filename)
        except Exception:
            logger.exception("Error in cleanup loop")

        try:
            purge_old_usage()
        except Exception:
            logger.exception("Error while purging stale rate limit entries")

        time.sleep(60)

# Démarrer le thread de nettoyage
cleanup_thread = threading.Thread(target=cleanup_old_files, daemon=True)
cleanup_thread.start()

# Routes dont les templates embarquent des scripts inline (JSON-LD, configuration
# analytics) : elles ont encore besoin de 'unsafe-inline', mais jamais de 'unsafe-eval'.
INLINE_SCRIPT_ROUTES = ('/',)
# /react compile le JSX dans le navigateur avec Babel standalone, qui évalue du code
# généré à la volée : c'est la seule route qui doit conserver 'unsafe-eval'.
BABEL_ROUTES = ('/react',)

def build_script_src(path):
    cdn_sources = (
        'https://cdn.tailwindcss.com https://cdn.jsdelivr.net '
        'https://cdnjs.cloudflare.com https://unpkg.com'
    )
    if path in BABEL_ROUTES:
        return f"'self' 'unsafe-inline' 'unsafe-eval' {cdn_sources}"
    if path in INLINE_SCRIPT_ROUTES:
        return f"'self' 'unsafe-inline' {cdn_sources}"
    # Version React compilée et reste du site : uniquement des scripts servis par l'app.
    return "'self'"

@app.after_request
def add_security_headers(response):
    csp = (
        "default-src 'self'; "
        f"script-src {build_script_src(request.path)}; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https://api.qrserver.com; "
        "media-src 'self' blob:; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "base-uri 'self';"
    )
    response.headers['Content-Security-Policy'] = csp
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/react')
def react_version():
    return render_template('react_index.html')

@app.route('/react-app')
def react_app():
    return send_from_directory('../static/react_build', 'index.html')

@app.route('/assets/<path:filename>')
def react_assets(filename):
    return send_from_directory('../static/react_build/assets', filename)

@app.route('/downloads/<path:filename>')
def download_file(filename):
    try:
        return send_from_directory(DOWNLOAD_FOLDER, filename, as_attachment=True)
    except NotFound:
        logger.warning("Requested download not found (expired or never created): %s", filename)
        return jsonify({'error': 'File not found. It may have expired, please convert again.'}), 404


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    """Journalise toute exception non gérée et renvoie une erreur JSON exploitable."""
    if isinstance(error, HTTPException):
        return error
    logger.exception("Unhandled error while serving %s", request.path)
    return jsonify({'error': 'Internal server error'}), 500

# 3. Route de conversion avec Streaming (SSE) pour la barre de progression réelle
@app.route('/api/convert', methods=['POST'])
def convert():
    client_ip = request.remote_addr
    
    # Vérifier la limite AVANT de commencer
    if not check_rate_limit(client_ip):
        return jsonify({'error': f'Daily limit reached ({DAILY_LIMIT}/{DAILY_LIMIT}). Try again tomorrow.'}), 429

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid request body: expected a JSON object.'}), 400

    video_url = data.get('url')
    requested_format = data.get('format', 'mp4-1080p')

    if not isinstance(video_url, str) or not video_url.strip():
        return jsonify({'error': 'Missing required field: url.'}), 400
    video_url = video_url.strip()

    # Validation URL stricte (schéma + domaine)
    if not is_supported_url(video_url):
        return jsonify({'error': 'Domain not supported. Only YouTube, TikTok, Instagram, Twitch.'}), 400

    if not is_supported_format(requested_format):
        return jsonify({'error': 'Unsupported format.'}), 400

    # Queue pour communiquer entre le thread de téléchargement et le générateur de réponse
    msg_queue = queue.Queue()

    def run_download():
        terminal_message_sent = False
        try:
            # Hook de progression pour yt-dlp
            def progress_hook(d):
                if d['status'] == 'downloading':
                    # Calcul du pourcentage
                    p = d.get('_percent_str', '0%').replace('%', '')
                    try:
                        percent = float(p)
                    except (TypeError, ValueError):
                        logger.debug("Could not parse yt-dlp percent value %r", p)
                        percent = 0
                    msg_queue.put({'type': 'progress', 'value': percent, 'status': 'Downloading...'})
                elif d['status'] == 'finished':
                    msg_queue.put({'type': 'progress', 'value': 100, 'status': 'Processing...'})

            ydl_opts = build_ydl_opts(requested_format, DOWNLOAD_FOLDER, progress_hook)

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(video_url, download=True)
                final_filename = resolve_final_filename(ydl, info_dict, ydl_opts, DOWNLOAD_FOLDER)
                basename = os.path.basename(final_filename)
                
                # Succès !
                if not os.path.exists(final_filename) or os.path.getsize(final_filename) == 0:
                    raise Exception("Downloaded file is empty or does not exist after conversion.")

                increment_usage(client_ip) # Incrémenter seulement si succès
                msg_queue.put({'type': 'complete', 'download_path': f'downloads/{basename}'})
                terminal_message_sent = True

        except Exception:
            # Ne pas exposer les détails internes (chemins, traces) au client
            logger.exception("Conversion failed for %s (format=%s)", video_url, requested_format)
            msg_queue.put({'type': 'error', 'message': 'Conversion failed. Please check the URL and try again.'})
            terminal_message_sent = True
        finally:
            # Le client attend toujours un évènement terminal : ne jamais le laisser en suspens.
            if not terminal_message_sent:
                msg_queue.put({'type': 'error', 'message': 'Conversion ended unexpectedly.'})

    # Lancer le téléchargement dans un thread séparé
    thread = threading.Thread(target=run_download)
    thread.start()

    # Générateur pour streamer les événements SSE
    def generate():
        while True:
            try:
                # Attendre un message de la queue (timeout pour éviter le blocage infini)
                msg = msg_queue.get(timeout=300) 
                
                yield sse_event(msg)
                
                if msg['type'] in ['complete', 'error']:
                    break
            except queue.Empty:
                # If queue is empty for too long, it means the download thread might be stuck or finished without sending complete/error
                # This can happen if yt-dlp fails silently or takes too long
                if not thread.is_alive():
                    # If thread is dead and queue is empty, assume an error occurred that wasn't caught by the hook
                    logger.error("Download thread for %s died without emitting a terminal event", video_url)
                    yield sse_error('Conversion process failed or timed out.')
                    break
                # If thread is still alive, continue waiting
                continue
            except Exception:
                logger.exception("Internal error while streaming progress for %s", video_url)
                yield sse_error('Internal server error during streaming.')
                break

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == '__main__':
    # Le mode debug expose la console interactive Werkzeug (exécution de code à distance) :
    # il doit rester désactivé sauf demande explicite en local.
    debug_enabled = os.environ.get('FLASK_DEBUG', '0').lower() in ('1', 'true', 'yes')
    app.run(
        host=os.environ.get('HOST', '127.0.0.1'),
        port=int(os.environ.get('PORT', 5000)),
        debug=debug_enabled,
    )

# PRODUCTION DEPLOYMENT:
# Use a WSGI server to avoid blocking threads with yt-dlp.
# Example with Gunicorn (Linux/Mac):
# gunicorn -k gevent -w 1 -b 0.0.0.0:5000 app:app
#
# Example with Waitress (Windows):
# waitress-serve --port=5000 app:app
