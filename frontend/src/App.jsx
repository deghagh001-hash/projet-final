import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

// ==========================================
// UTILS: Easter Egg Effects
// ==========================================
const triggerMatrixEffect = () => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

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
};

const triggerSilentHillEffect = () => {
    const videoOverlay = document.createElement('div');
    videoOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    
    const video = document.createElement('video');
    video.src = "/static/video/sillent hill.mp4";
    video.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
    video.autoplay = true;
    video.loop = true;
    video.muted = false;
    video.volume = 0.3;
    
    videoOverlay.appendChild(video);
    document.body.appendChild(videoOverlay);
    
    const cleanup = () => {
        video.pause();
        videoOverlay.remove();
        document.removeEventListener('keydown', cleanup);
        document.removeEventListener('click', cleanup);
    };
    
    document.addEventListener('keydown', cleanup, { once: true });
    document.addEventListener('click', cleanup, { once: true });
};

const triggerHackEffect = () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;color:#0f0;z-index:9999;font-family:monospace;padding:20px;font-size:20px;overflow:hidden;white-space:pre-wrap;';
    document.body.appendChild(overlay);

    const text = "INITIALIZING HACK TOOL...\nCONNECTING TO SERVER...\nBYPASSING FIREWALL...\nDECRYPTING PASSWORDS...\nACCESSING DATABASE...\n\n> HACK COMPLETE NEO";
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
};

const triggerAlgerieEffect = () => {
    const img = document.createElement('img');
    img.src = "/static/img/algerie.jpg";
    img.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);max-width:90%;max-height:90%;z-index:9999;box-shadow: 0 0 50px rgba(0,0,0,0.8); border: 5px solid white;';
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 5000);
};

const triggerPes6Effect = () => {
    const audio = new Audio("/static/audio/pes.mp3");
    audio.volume = 0.05;
    audio.loop = true;
    audio.play().catch(e => console.log('Audio play failed:', e));

    const img = document.createElement('img');
    img.src = "/static/img/pes.webp";
    img.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);max-width:80%;max-height:80%;z-index:10000;box-shadow: 0 0 20px rgba(0,0,0,0.5);';
    document.body.appendChild(img);

    const cleanup = () => {
        audio.pause();
        img.remove();
        document.removeEventListener('keydown', cleanup);
        document.removeEventListener('click', cleanup);
    };

    document.addEventListener('keydown', cleanup, { once: true });
    document.addEventListener('click', cleanup, { once: true });
};

const showFullscreenLogo = () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    const logo = document.createElement('img');
    logo.src = "/static/img/logo.png";
    logo.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;animation:logoZoom 0.5s ease-out;';
    
    if (!document.getElementById('logo-anim-style')) {
        const style = document.createElement('style');
        style.id = 'logo-anim-style';
        style.textContent = '@keyframes logoZoom { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }';
        document.head.appendChild(style);
    }

    overlay.appendChild(logo);
    document.body.appendChild(overlay);
    
    // Trigger Confetti - Big Burst Effect
    var duration = 3000;
    var end = Date.now() + duration;
    
    // Initial big burst
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#EF4444', '#FFFFFF', '#FFD700'],
        zIndex: 100000
    });
    
    // Continuous celebration for 3 seconds
    var interval = setInterval(function() {
        if (Date.now() > end) {
            clearInterval(interval);
            return;
        }
        
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#EF4444', '#FFFFFF', '#FFD700'],
            zIndex: 100000
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#EF4444', '#FFFFFF', '#FFD700'],
            zIndex: 100000
        });
    }, 50);
    
    overlay.onclick = () => overlay.remove();
};

// ==========================================
// COMPOSANT : TOAST (Error Handling)
// ==========================================
const Toast = ({ message, onClose }) => {
    if (!message) return null;
    return (
        <div className="fixed top-5 right-5 bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl z-50 animate-fade-in flex items-center gap-3">
            <span>⚠️</span>
            <p className="font-medium">{message}</p>
            <button onClick={onClose} className="ml-4 text-white/80 hover:text-white">✕</button>
        </div>
    );
};

// ==========================================
// COMPOSANT : HEADER
// ==========================================
function Header({ themeColor, setThemeColor, currentPage, setPage }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#ffffff'];

    const navItems = [
        { id: 'home', label: 'Converter' },
        { id: 'faq', label: 'FAQ' },
        { id: 'about', label: 'About Us' },
        { id: 'eastereggs', label: 'Secrets 🤫' },
    ];

    return (
        <header className="bg-transparent backdrop-blur-lg sticky top-0 z-50 border-b border-gray-700/50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex-shrink-0 flex items-center gap-4">
                        <a href="#" onClick={(e) => { e.preventDefault(); showFullscreenLogo(); }} className="text-2xl font-bold text-red-500 flex items-center" style={{color: themeColor}}>
                            <span className="cursor-pointer hover:scale-105 transition-transform">youtubetomp4</span>
                        </a>
                        
                        <div className="relative group">
                            <button className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 border border-white/20 shadow-lg hover:scale-110 transition-transform"></button>
                            <div className="absolute left-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl hidden group-hover:block w-48 z-50">
                                <div className="grid grid-cols-5 gap-2">
                                    {colors.map(c => (
                                        <button 
                                            key={c} 
                                            onClick={() => setThemeColor(c)}
                                            style={{ backgroundColor: c }}
                                            className="w-6 h-6 rounded-full hover:scale-110 transition-transform border border-gray-600"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <nav className="hidden md:block">
                        <div className="ml-10 flex items-center space-x-4">
                            {navItems.map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => setPage(item.id)}
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === item.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </nav>

                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-gray-300 hover:text-white p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </div>
            </div>
            
            {isMenuOpen && (
                <div className="md:hidden bg-gray-800 border-t border-gray-700">
                     <div className="flex flex-col py-2 space-y-1">
                        {navItems.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => { setPage(item.id); setIsMenuOpen(false); }}
                                className={`text-left px-4 py-3 rounded-md transition-colors ${currentPage === item.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                     </div>
                </div>
            )}
        </header>
    );
}

// ==========================================
// COMPOSANT : CONVERTER
// ==========================================
function Converter({ onError }) {
    const [url, setUrl] = useState('');
    const [platform, setPlatform] = useState('youtube');
    const [format, setFormat] = useState('mp4-1080p');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [result, setResult] = useState(null);
    const [conversionsLeft, setConversionsLeft] = useState(5);

    useEffect(() => {
        const stored = localStorage.getItem('conversionsLeft');
        const lastDate = localStorage.getItem('lastConversionDate');
        const today = new Date().toDateString();

        if (lastDate !== today) {
            localStorage.setItem('lastConversionDate', today);
            localStorage.setItem('conversionsLeft', 5);
            setConversionsLeft(5);
        } else if (stored !== null) {
            setConversionsLeft(parseInt(stored));
        }
    }, []);

    const handleUrlChange = (e) => {
        const val = e.target.value;
        setUrl(val);
        
        const lowerVal = val.toLowerCase().trim();
        if (lowerVal === 'matrix') { setUrl(''); triggerMatrixEffect(); }
        if (lowerVal === 'hack') { setUrl(''); triggerHackEffect(); }
        if (lowerVal === 'silent hill') { setUrl(''); triggerSilentHillEffect(); }
        if (lowerVal.includes("viva l'algerie") || lowerVal.includes("viva algerie")) { setUrl(''); triggerAlgerieEffect(); }
        if (lowerVal === 'pes 6' || lowerVal === 'pes6') { setUrl(''); triggerPes6Effect(); }
    };

    const handleConvert = async () => {
        if (conversionsLeft <= 0) {
            onError("Daily limit reached (5/5).");
            return;
        }

        setLoading(true);
        setResult(null);
        setProgress(0);
        setStatus('Connecting...');

        try {
            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format }),
            });

            if (!response.ok) {
                if (response.status === 429) throw new Error('Daily limit reached.');
                let message = `Server error (HTTP ${response.status})`;
                try {
                    const err = await response.json();
                    if (err && err.error) message = err.error;
                } catch (parseError) {
                    console.error('Could not parse error response:', parseError);
                }
                throw new Error(message);
            }

            if (!response.body) throw new Error('Streaming is not supported by this browser.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let receivedTerminalEvent = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        let data;
                        try {
                            data = JSON.parse(line.slice(6));
                        } catch (parseError) {
                            console.error('Malformed server event:', line, parseError);
                            throw new Error('Received a malformed response from the server.');
                        }
                        if (data.type === 'complete' || data.type === 'error') receivedTerminalEvent = true;
                        if (data.type === 'progress') {
                            setProgress(data.value);
                            setStatus(data.status);
                        } else if (data.type === 'complete') {
                            setResult(data.download_path);
                            setStatus('Complete!');
                            
                            const newLimit = conversionsLeft - 1;
                            setConversionsLeft(newLimit);
                            localStorage.setItem('conversionsLeft', newLimit);
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    }
                }
            }

            if (!receivedTerminalEvent) {
                throw new Error('Connection closed before the conversion finished.');
            }
        } catch (err) {
            onError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section id="converter" className="py-20 animate-fade-in">
            <div className="container mx-auto px-4 text-center">
                <h1 className="text-3xl md:text-5xl font-extrabold mb-8 retro-title text-yellow-400">Welcome to youtubetomp4</h1>
                <p className="text-base text-gray-300 max-w-2xl mx-auto mb-8 font-mono">
                    Convert any video from different web site to video mp4 and audio mp3 format
                </p>

                <div className="flex justify-center flex-wrap gap-4 mb-8">
                    {['youtube', 'tiktok', 'instagram', 'twitch'].map(p => (
                        <button 
                            key={p}
                            onClick={() => setPlatform(p)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${platform === p ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>

                {/* Input Area - Hidden during loading or when result is shown */}
                {!loading && !result && (
                    <>
                        <div className="max-w-2xl mx-auto relative animate-fade-in">
                            <div className="flex">
                                <input 
                                    type="text" 
                                    value={url}
                                    onChange={handleUrlChange}
                                    placeholder={`Paste ${platform} video URL here...`}
                                    className="flex-grow p-4 text-lg bg-gray-100 text-gray-900 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                                <button 
                                    onClick={handleConvert}
                                    disabled={loading || !url}
                                    className="bg-red-600 text-white font-bold p-4 text-lg rounded-r-lg hover:bg-red-700 disabled:bg-gray-600 transition-colors min-w-[120px]"
                                >
                                    Convert
                                </button>
                            </div>
                            
                            <div className="flex justify-between items-center mt-2 text-sm">
                                <span className={conversionsLeft === 0 ? "text-red-500" : "text-gray-400"}>
                                    Daily limit: {conversionsLeft}/5
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="bg-gray-800/50 p-4 rounded-lg">
                                <h4 className="text-red-500 font-bold mb-3">Video</h4>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {['mp4-1080p', 'mp4-720p', 'mp4-480p'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFormat(f)}
                                            className={`px-3 py-1 rounded text-sm border ${format === f ? 'bg-red-600 border-red-600 text-white' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                                        >
                                            {f.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-gray-800/50 p-4 rounded-lg">
                                <h4 className="text-red-500 font-bold mb-3">Audio</h4>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {['mp3-128k', 'mp3-320k', 'wav'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFormat(f)}
                                            className={`px-3 py-1 rounded text-sm border ${format === f ? 'bg-red-600 border-red-600 text-white' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                                        >
                                            {f.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Progress Bar - Only shown when loading */}
                {loading && (
                    <div className="mt-6 max-w-2xl mx-auto animate-fade-in">
                        <div className="text-center mb-4">
                            <h3 className="text-xl font-bold text-white">Conversion in Progress</h3>
                            <p className="text-gray-300 mt-2">{status}</p>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="bg-red-600 h-2.5 rounded-full transition-all duration-300" style={{width: `${progress}%`}}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0%</span>
                            <span>{Math.round(progress)}%</span>
                            <span>100%</span>
                        </div>
                    </div>
                )}

                {/* Result Card - Only shown when result exists */}
                {result && (
                    <div className="mt-8 max-w-2xl mx-auto bg-gray-800 p-6 rounded-xl border border-gray-700 animate-fade-in">
                        <h3 className="text-xl font-bold text-white mb-4">Conversion Successful!</h3>
                        <p className="text-gray-300 mb-6 font-mono text-sm break-all">{result.split(/[\\/]/).pop()}</p>
                        
                        <div className="flex flex-col gap-3">
                            <a 
                                href={`/${result}`} 
                                download 
                                onClick={() => setTimeout(() => setResult(null), 60000)}
                                className="w-full bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                📥 Download File
                            </a>
                            <button 
                                onClick={() => { setResult(null); setUrl(''); }}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                🔄 Convert Another
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

// ==========================================
// COMPOSANT : EASTER EGGS PAGE
// ==========================================
function EasterEggsPage() {
    return (
        <section className="py-12 animate-fade-in">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
                        Secret Easter Eggs
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        You found the secret page! Here are all the hidden commands you can
                        type in the video URL box to trigger special effects.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[
                        { icon: '🖥️', title: 'The Matrix', color: 'text-green-500', desc: 'Enter the digital rain.', code: 'matrix' },
                        { icon: '🌫️', title: 'Silent Hill', color: 'text-red-800', desc: 'Welcome to your nightmare.', code: 'silent hill' },
                        { icon: '⚽', title: 'PES 6 Legend', color: 'text-blue-500', desc: 'Relive the golden age of football.', code: 'pes 6' },
                        { icon: '🇩🇿', title: 'Viva l\'Algérie', color: 'text-green-600', desc: 'Celebrate with the national colors.', code: '123 viva l\'algerie' },
                        { icon: '👨‍💻', title: 'System Hack', color: 'text-green-400', desc: 'Simulate a system breach.', code: 'hack' },
                    ].map((egg, idx) => (
                        <div key={idx} className="bg-gray-800/50 backdrop-blur-md border border-gray-700 p-6 rounded-xl hover:transform hover:-translate-y-2 transition-all duration-300 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20">
                            <div className="text-4xl mb-4">{egg.icon}</div>
                            <h3 className={`text-2xl font-bold mb-2 ${egg.color}`}>{egg.title}</h3>
                            <p className="text-gray-300 mb-4">{egg.desc}</p>
                            <div className="bg-gray-900 p-3 rounded-lg">
                                <span className="text-gray-500 text-sm block mb-1">Type in URL box:</span>
                                <code className="block text-center text-green-400 font-mono">{egg.code}</code>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function FAQ() {
    const [activeIndex, setActiveIndex] = useState(null);
    const questions = [
        { q: "Is it legal?", a: "For personal use only. Respect copyright laws." },
        { q: "Is it free?", a: "Yes, completely free with a daily limit of 5 videos." },
        { q: "Which formats?", a: "MP4 (up to 1080p) and MP3 (up to 320kbps)." }
    ];

    return (
        <section id="faq" className="py-12 bg-gray-900/50 animate-fade-in">
            <div className="container mx-auto px-4 max-w-3xl">
                <h2 className="text-3xl font-bold text-center mb-8 text-white">FAQ</h2>
                <div className="space-y-4">
                    {questions.map((item, idx) => (
                        <div key={idx} className="bg-gray-800 rounded-lg overflow-hidden">
                            <button 
                                onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
                                className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-700 transition-colors"
                            >
                                <span className="font-semibold text-white">{item.q}</span>
                                <span className={`transform transition-transform ${activeIndex === idx ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                            {activeIndex === idx && (
                                <div className="px-6 py-4 text-gray-300 border-t border-gray-700">
                                    {item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function About() {
    return (
        <section className="py-20 animate-fade-in">
            <div className="container mx-auto px-4 max-w-3xl text-center">
                <h2 className="text-3xl font-bold mb-8">About Us</h2>
                <p className="text-gray-300 mb-6">
                    We are a team of developers passionate about making video accessibility easier for everyone.
                    Our goal is to provide a fast, free, and secure tool for downloading content from the web.
                </p>
            </div>
        </section>
    );
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function App() {
    const [themeColor, setThemeColor] = useState('#EF4444');
    const [currentPage, setCurrentPage] = useState('home');
    const [toastMessage, setToastMessage] = useState(null);

    useEffect(() => {
        document.documentElement.style.setProperty('--accent-color', themeColor);
        const style = document.createElement('style');
        style.innerHTML = `
            .text-red-500 { color: ${themeColor} !important; }
            .bg-red-600 { background-color: ${themeColor} !important; }
            .border-red-600 { border-color: ${themeColor} !important; }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, [themeColor]);

    const renderPage = () => {
        switch(currentPage) {
            case 'home':
                return <Converter onError={setToastMessage} />;
            case 'faq': return <FAQ />;
            case 'about': return <About />;
            case 'eastereggs': return <EasterEggsPage />;
            default: return <Converter onError={setToastMessage} />;
        }
    };

    return (
        <div className="min-h-screen font-sans text-white flex flex-col">
            <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
            
            <Header 
                themeColor={themeColor} 
                setThemeColor={setThemeColor} 
                currentPage={currentPage}
                setPage={setCurrentPage}
            />
            
            <main className="flex-grow">
                {renderPage()}
            </main>

            <footer className="bg-gray-900 py-8 text-center text-gray-500 text-sm mt-auto">
                <p>&copy; 2025 YouTube to MP4. Built with React & Flask.</p>
            </footer>
        </div>
    );
}

export default App;
