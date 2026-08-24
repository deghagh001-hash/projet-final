// Client de conversion partagé : appel de /api/convert et lecture du flux SSE.

export const VIDEO_FORMATS = ['mp4-1080p', 'mp4-720p', 'mp4-480p'];
export const AUDIO_FORMATS = ['mp3-128k', 'mp3-320k', 'wav'];
export const DEFAULT_FORMAT = 'mp4-1080p';

export function filenameFromPath(path) {
    return String(path).split(/[\\/]/).pop();
}

export function triggerDownload(path) {
    const link = document.createElement('a');
    link.href = '/' + String(path).replace(/\\/g, '/');
    link.download = filenameFromPath(path);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Lance une conversion et relaie les évènements SSE du serveur.
 *
 * @param {Object} options
 * @param {string} options.url URL de la vidéo à convertir.
 * @param {string} [options.format] Format demandé (voir VIDEO_FORMATS / AUDIO_FORMATS).
 * @param {(percent: number, status: string) => void} [options.onProgress]
 * @param {(downloadPath: string) => void} [options.onComplete]
 * @returns {Promise<string>} chemin de téléchargement du fichier converti.
 * @throws {Error} si le serveur refuse la requête ou si la conversion échoue.
 */
export async function convertVideo({ url, format = DEFAULT_FORMAT, onProgress, onComplete }) {
    const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format }),
    });

    if (!response.ok) {
        if (response.status === 429) throw new Error('Daily limit reached. Please try again tomorrow.');
        const err = await response.json().catch((parseError) => {
            console.error('Could not parse error response:', parseError);
            return {};
        });
        throw new Error(err.error || `Server error (HTTP ${response.status})`);
    }

    if (!response.body) throw new Error('Streaming is not supported by this browser.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let downloadPath = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop();

        for (const raw of chunks) {
            const chunk = raw.trim();
            if (!chunk.startsWith('data: ')) continue;
            let data;
            try {
                data = JSON.parse(chunk.slice(6));
            } catch (parseError) {
                console.error('Malformed server event:', chunk, parseError);
                throw new Error('Received a malformed response from the server.');
            }

            if (data.type === 'progress') {
                if (onProgress) onProgress(data.value, data.status);
            } else if (data.type === 'complete') {
                downloadPath = data.download_path;
                if (onComplete) onComplete(downloadPath);
            } else if (data.type === 'error') {
                throw new Error(data.message);
            }
        }
    }

    // Le flux peut se fermer sans évènement terminal (serveur redémarré, proxy, réseau) :
    // sans cette vérification l'appelant recevrait `null` comme si tout allait bien.
    if (!downloadPath) {
        throw new Error('Connection closed before the conversion finished.');
    }

    return downloadPath;
}

if (typeof window !== 'undefined') {
    window.ConvertClient = {
        VIDEO_FORMATS,
        AUDIO_FORMATS,
        DEFAULT_FORMAT,
        filenameFromPath,
        triggerDownload,
        convertVideo,
    };
}
