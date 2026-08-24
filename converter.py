"""Utilitaires de conversion partagés par les routes Flask."""

import glob
import json
import os
import re
import time

ALLOWED_DOMAINS = re.compile(r'(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitch\.tv)')

DEFAULT_VIDEO_FORMAT = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'


def _mp4(height):
    return f'bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'


def _audio(codec, quality=None):
    postprocessor = {'key': 'FFmpegExtractAudio', 'preferredcodec': codec}
    if quality:
        postprocessor['preferredquality'] = quality
    return {'format': 'bestaudio/best', 'postprocessors': [postprocessor]}


# Chaque preset décrit les options yt-dlp propres au format demandé.
FORMAT_PRESETS = {
    'mp4-1080p': {'format': _mp4(1080)},
    'mp4-720p': {'format': _mp4(720)},
    'mp4-480p': {'format': _mp4(480)},
    'mp3-128k': _audio('mp3', '128'),
    'mp3-320k': _audio('mp3', '320'),
    'wav': _audio('wav'),
}


def is_supported_url(video_url):
    return bool(video_url) and bool(ALLOWED_DOMAINS.search(video_url))


def build_ydl_opts(requested_format, download_folder, progress_hook):
    """Options yt-dlp pour le format demandé (retombe sur le meilleur MP4 si inconnu)."""
    opts = {
        'outtmpl': f'{download_folder}/%(title)s.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'progress_hooks': [progress_hook],
    }
    opts.update(FORMAT_PRESETS.get(requested_format, {'format': DEFAULT_VIDEO_FORMAT}))
    return opts


def resolve_final_filename(ydl, info_dict, ydl_opts, download_folder):
    """Chemin du fichier produit, en tenant compte des renommages de post-traitement."""
    filename = ydl.prepare_filename(info_dict)
    if 'postprocessors' not in ydl_opts:
        return filename

    target_ext = ydl_opts['postprocessors'][0]['preferredcodec']
    final_filename = filename.rsplit('.', 1)[0] + '.' + target_ext
    if os.path.exists(final_filename):
        return final_filename

    # yt-dlp peut renommer le fichier pendant le post-traitement : on cherche le
    # fichier le plus récent correspondant au nom de base attendu.
    expected_base = os.path.basename(filename).rsplit('.', 1)[0]
    candidates = glob.glob(f'{download_folder}/*')
    matching = [
        path for path in candidates
        if os.path.basename(path).startswith(expected_base) and path.endswith(target_ext)
    ]
    if matching:
        return max(matching, key=os.path.getctime)

    recent = [path for path in candidates if os.path.getctime(path) > (time.time() - 10)]
    if recent:
        return max(recent, key=os.path.getctime)

    raise Exception("Could not determine final filename after conversion.")


def sse_event(payload):
    """Sérialise un message au format Server-Sent Events."""
    return f"data: {json.dumps(payload)}\n\n"


def sse_error(message):
    return sse_event({'type': 'error', 'message': message})
