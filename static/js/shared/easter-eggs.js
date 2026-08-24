// Effets "Easter Egg" partagés entre la version classique (main.js),
// la version React in-browser (react_app.jsx) et la version compilée (frontend/src).

const CONFETTI_COLORS = ['#EF4444', '#FFFFFF', '#FFD700'];

function dismissOnInteraction(cleanup) {
    const handler = () => {
        cleanup();
        document.removeEventListener('keydown', handler);
        document.removeEventListener('click', handler);
    };
    document.addEventListener('keydown', handler, { once: true });
    document.addEventListener('click', handler, { once: true });
}

function overlayImage(src, cssText) {
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = cssText;
    document.body.appendChild(img);
    return img;
}

export function triggerMatrixEffect() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
    const fontSize = 14;
    const drops = Array(Math.floor(canvas.width / fontSize)).fill(1);

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0F0';
        ctx.font = `${fontSize}px monospace`;
        for (let i = 0; i < drops.length; i++) {
            ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }

    const interval = setInterval(draw, 33);
    setTimeout(() => { clearInterval(interval); canvas.remove(); }, 10000);
}

export function triggerSilentHillEffect() {
    const videoOverlay = document.createElement('div');
    videoOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;';

    const video = document.createElement('video');
    video.src = '/static/video/sillent hill.mp4';
    video.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
    video.autoplay = true;
    video.loop = true;
    video.muted = false;
    video.volume = 0.3;

    videoOverlay.appendChild(video);
    document.body.appendChild(videoOverlay);

    dismissOnInteraction(() => {
        video.pause();
        videoOverlay.remove();
    });
}

export function triggerHackEffect() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;color:#0f0;z-index:9999;font-family:monospace;padding:20px;font-size:20px;overflow:hidden;white-space:pre-wrap;';
    document.body.appendChild(overlay);

    const text = 'INITIALIZING HACK TOOL...\nCONNECTING TO SERVER...\nBYPASSING FIREWALL...\nDECRYPTING PASSWORDS...\nACCESSING DATABASE...\n\n> HACK COMPLETE NEO';
    let i = 0;

    function typeWriter() {
        if (i < text.length) {
            overlay.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 50);
        } else {
            setTimeout(() => overlay.remove(), 3000);
        }
    }
    typeWriter();
}

export function triggerAlgerieEffect() {
    const img = overlayImage(
        '/static/img/algerie.jpg',
        'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);max-width:90%;max-height:90%;z-index:9999;box-shadow: 0 0 50px rgba(0,0,0,0.8); border: 5px solid white;'
    );
    setTimeout(() => img.remove(), 5000);
}

export function triggerPes6Effect() {
    const audio = new Audio('/static/audio/pes.mp3');
    audio.volume = 0.05;
    audio.loop = true;
    audio.play().catch(e => console.log('Audio play failed:', e));

    const img = overlayImage(
        '/static/img/pes.webp',
        'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);max-width:80%;max-height:80%;z-index:10000;box-shadow: 0 0 20px rgba(0,0,0,0.5);'
    );

    dismissOnInteraction(() => {
        audio.pause();
        img.remove();
    });
}

export function initGravityMode() {
    alert('Gravity mode: This feature requires Matter.js. Simulated effect with an alert.');
}

// `confetti` est global (CDN) sur les pages servies par Flask et importé depuis
// canvas-confetti dans le build Vite : on le laisse injectable.
export function showFullscreenLogo({ confetti = (typeof window !== 'undefined' ? window.confetti : null) } = {}) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';

    const logo = document.createElement('img');
    logo.src = '/static/img/logo.png';
    logo.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;animation:logoZoom 0.5s ease-out;';

    if (!document.getElementById('logo-anim-style')) {
        const style = document.createElement('style');
        style.id = 'logo-anim-style';
        style.textContent = '@keyframes logoZoom { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }';
        document.head.appendChild(style);
    }

    overlay.appendChild(logo);
    document.body.appendChild(overlay);

    if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: CONFETTI_COLORS, zIndex: 100000 });

        const end = Date.now() + 3000;
        const interval = setInterval(() => {
            if (Date.now() > end) {
                clearInterval(interval);
                return;
            }
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: CONFETTI_COLORS, zIndex: 100000 });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: CONFETTI_COLORS, zIndex: 100000 });
        }, 50);
    } else {
        console.error('Confetti library not loaded!');
    }

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
    };
    const escHandler = e => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', escHandler);
}

export const EASTER_EGG_COMMANDS = {
    'matrix': triggerMatrixEffect,
    'hack': triggerHackEffect,
    'gravity': initGravityMode,
    'silent hill': triggerSilentHillEffect,
    'pes 6': triggerPes6Effect,
    'pes6': triggerPes6Effect,
    "123 viva l'algerie": triggerAlgerieEffect,
    '123 viva algerie': triggerAlgerieEffect,
};

/**
 * Déclenche l'effet associé à la valeur saisie dans le champ URL.
 * @returns {boolean} true si un easter egg a été déclenché.
 */
export function triggerEasterEgg(value) {
    const effect = EASTER_EGG_COMMANDS[String(value).toLowerCase().trim()];
    if (!effect) return false;
    effect();
    return true;
}

if (typeof window !== 'undefined') {
    window.EasterEggs = {
        triggerMatrixEffect,
        triggerSilentHillEffect,
        triggerHackEffect,
        triggerAlgerieEffect,
        triggerPes6Effect,
        initGravityMode,
        showFullscreenLogo,
        EASTER_EGG_COMMANDS,
        triggerEasterEgg,
    };
}
