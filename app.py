from flask import Flask, render_template, request, jsonify, send_from_directory, Response, stream_with_context
import yt_dlp
import os
import time
import threading
import shutil
import queue
from datetime import datetime

from converter import (
    build_ydl_opts,
    is_supported_format,
    is_supported_url,
    resolve_final_filename,
    sse_error,
    sse_event,
)

app = Flask(__name__)
DOWNLOAD_FOLDER = 'downloads'

# 1. Vérification de FFmpeg
if not shutil.which('ffmpeg'):
    print("ATTENTION : FFmpeg n'est pas installe ou n'est pas dans le PATH systeme.")
    print("   Les conversions MP3 et les vidéos haute qualite (1080p+) pourraient echouer.")
else:
    print("FFmpeg detecte.")

# Assurer que le dossier de téléchargement existe
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

# 2. Système de Rate Limiting (Limitation par IP)
# Stockage en mémoire : { 'ip_address': { 'date': 'YYYY-MM-DD', 'count': 0 } }
clients_usage = {}
usage_lock = threading.Lock()
DAILY_LIMIT = 8

def check_rate_limit(ip_address):
    today = datetime.now().strftime('%Y-%m-%d')

    with usage_lock:
        # Purger les entrées des jours précédents pour borner la mémoire utilisée
        for ip in [ip for ip, client in clients_usage.items() if client['date'] != today]:
            del clients_usage[ip]

        client = clients_usage.setdefault(ip_address, {'date': today, 'count': 0})
        return client['count'] < DAILY_LIMIT

def increment_usage(ip_address):
    with usage_lock:
        if ip_address in clients_usage:
            clients_usage[ip_address]['count'] += 1

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
                                print(f"Deleted old file: {filename}")
                            except Exception as e:
                                print(f"Error deleting {filename}: {e}")
        except Exception as e:
            print(f"Error in cleanup loop: {e}")
        time.sleep(60)

# Démarrer le thread de nettoyage
cleanup_thread = threading.Thread(target=cleanup_old_files, daemon=True)
cleanup_thread.start()

@app.after_request
def add_security_headers(response):
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com; "
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
    return send_from_directory(DOWNLOAD_FOLDER, filename, as_attachment=True)

# 3. Route de conversion avec Streaming (SSE) pour la barre de progression réelle
@app.route('/api/convert', methods=['POST'])
def convert():
    client_ip = request.remote_addr
    
    # Vérifier la limite AVANT de commencer
    if not check_rate_limit(client_ip):
        return jsonify({'error': f'Daily limit reached ({DAILY_LIMIT}/{DAILY_LIMIT}). Try again tomorrow.'}), 429

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid JSON body.'}), 400

    video_url = data.get('url')
    requested_format = data.get('format', 'mp4-1080p')

    # Validation URL stricte (schéma + domaine)
    if not is_supported_url(video_url):
        return jsonify({'error': 'Domain not supported. Only YouTube, TikTok, Instagram, Twitch.'}), 400

    if not is_supported_format(requested_format):
        return jsonify({'error': 'Unsupported format.'}), 400

    video_url = video_url.strip()

    # Queue pour communiquer entre le thread de téléchargement et le générateur de réponse
    msg_queue = queue.Queue()

    def run_download():
        try:
            # Hook de progression pour yt-dlp
            def progress_hook(d):
                if d['status'] == 'downloading':
                    # Calcul du pourcentage
                    p = d.get('_percent_str', '0%').replace('%', '')
                    try:
                        percent = float(p)
                    except:
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

        except Exception:
            # Ne pas exposer les détails internes (chemins, traces) au client
            app.logger.exception('Conversion failed for format %s', requested_format)
            msg_queue.put({'type': 'error', 'message': 'Conversion failed. Please check the URL and try again.'})

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
                    yield sse_error('Conversion process failed or timed out.')
                    break
                # If thread is still alive, continue waiting
                continue
            except Exception:
                app.logger.exception('SSE streaming failed')
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
