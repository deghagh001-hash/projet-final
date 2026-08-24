// Version React "in-browser" (transformée par Babel standalone, cf. templates/react_index.html).
// Les effets Easter Egg, le client de conversion et le quota quotidien viennent
// des modules partagés (static/js/shared/*), également utilisés par main.js et frontend/src.
const { triggerEasterEgg } = window.EasterEggs;
const { VIDEO_FORMATS, AUDIO_FORMATS, DEFAULT_FORMAT, convertVideo } = window.ConvertClient;
const { DAILY_LIMIT, readConversionsLeft, consumeConversion } = window.DailyLimit;

console.log('React App Script Starting...');

// ==========================================
// COMPOSANT : HEADER
// ==========================================
function Header({ themeColor, setThemeColor, currentPage, setPage }) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
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
                        <a href="#" onClick={(e) => { e.preventDefault(); setPage('home'); }} className="text-2xl font-bold brand-font text-red-500 flex items-center">
                            <img src="/static/img/logo.png" alt="Logo" className="w-8 h-8 mr-2" />
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
// COMPOSANT : SELECTEUR DE FORMAT
// ==========================================
function FormatGroup({ title, formats, selected, onSelect }) {
    return (
        <div className="bg-gray-800/50 p-4 rounded-lg">
            <h4 className="text-red-500 font-bold mb-3">{title}</h4>
            <div className="flex flex-wrap gap-2 justify-center">
                {formats.map(f => (
                    <button
                        key={f}
                        onClick={() => onSelect(f)}
                        className={`px-3 py-1 rounded text-sm border ${selected === f ? 'bg-red-600 border-red-600 text-white' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    >
                        {f.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// COMPOSANT : CONVERTER
// ==========================================
function Converter() {
    const [url, setUrl] = React.useState('');
    const [platform, setPlatform] = React.useState('youtube');
    const [format, setFormat] = React.useState(DEFAULT_FORMAT);
    const [loading, setLoading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [status, setStatus] = React.useState('');
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [conversionsLeft, setConversionsLeft] = React.useState(DAILY_LIMIT);

    React.useEffect(() => {
        setConversionsLeft(readConversionsLeft());
    }, []);

    const handleUrlChange = (e) => {
        const val = e.target.value;
        setUrl(triggerEasterEgg(val) ? '' : val);
    };

    const handleConvert = async () => {
        if (conversionsLeft <= 0) {
            setError(`Daily limit reached (${DAILY_LIMIT}/${DAILY_LIMIT}).`);
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setProgress(0);
        setStatus('Connecting...');

        try {
            await convertVideo({
                url,
                format,
                onProgress: (percent, statusText) => {
                    setProgress(percent);
                    setStatus(statusText);
                },
                onComplete: (downloadPath) => {
                    setResult(downloadPath);
                    setStatus('Complete!');
                    setConversionsLeft(consumeConversion());
                },
            });
        } catch (err) {
            setError(err.message);
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

                <div className="max-w-2xl mx-auto relative">
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
                            {loading ? <div className="spinner mx-auto"></div> : 'Convert'}
                        </button>
                    </div>

                    <div className="flex justify-between items-center mt-2 text-sm">
                        <span className={conversionsLeft === 0 ? "text-red-500" : "text-gray-400"}>
                            Daily limit: {conversionsLeft}/{DAILY_LIMIT}
                        </span>
                    </div>

                    {error && (
                        <div className="bg-red-500 text-white p-3 rounded-lg mt-4 text-center animate-fade-in">
                            {error}
                        </div>
                    )}
                </div>

                <div className="mt-8 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormatGroup title="Video" formats={VIDEO_FORMATS} selected={format} onSelect={setFormat} />
                    <FormatGroup title="Audio" formats={AUDIO_FORMATS} selected={format} onSelect={setFormat} />
                </div>

                {loading && (
                    <div className="mt-6 max-w-2xl mx-auto">
                        <p className="text-gray-300 mb-2">{status}</p>
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

                {result && (
                    <div className="mt-8 max-w-2xl mx-auto bg-gray-800 p-6 rounded-xl border border-gray-700 animate-fade-in">
                        <h3 className="text-xl font-bold text-white mb-4">Conversion Successful!</h3>
                        <div className="flex gap-4 justify-center">
                            <a
                                href={`/${result}`}
                                download
                                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold transition-colors flex items-center gap-2"
                            >
                                📥 Download File
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

// ==========================================
// COMPOSANT : BATCH CONVERTER
// ==========================================
function BatchConverter() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [urls, setUrls] = React.useState('');
    const [items, setItems] = React.useState([]);
    const [processing, setProcessing] = React.useState(false);

    const updateItem = (index, changes) => {
        setItems(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], ...changes };
            return copy;
        });
    };

    const startBatch = async () => {
        const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (urlList.length === 0 || urlList.length > 3) {
            alert("Please enter 1 to 3 URLs.");
            return;
        }

        setProcessing(true);
        const newItems = urlList.map(url => ({ url, status: 'Pending...', progress: 0, error: null, result: null }));
        setItems(newItems);

        for (let i = 0; i < newItems.length; i++) {
            await processItem(i, newItems[i].url);
        }
        setProcessing(false);
    };

    const processItem = async (index, url) => {
        updateItem(index, { status: 'Starting...' });

        try {
            await convertVideo({
                url,
                format: DEFAULT_FORMAT,
                onProgress: (percent) => updateItem(index, { progress: percent, status: `Downloading ${Math.round(percent)}%` }),
                onComplete: (downloadPath) => updateItem(index, { status: 'Done ✓', result: downloadPath, progress: 100 }),
            });
        } catch (e) {
            updateItem(index, { status: 'Failed ❌', error: e.message });
        }
    };

    return (
        <div className="container mx-auto px-4 text-center pb-20">
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-purple-500/30 transition-all"
                >
                    Batch Convert (3 Videos Max)
                </button>
            ) : (
                <div className="max-w-2xl mx-auto bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-700 shadow-xl animate-fade-in">
                    <h3 className="text-xl font-bold text-white mb-4">Batch Converter</h3>
                    {!processing && items.length === 0 && (
                        <React.Fragment>
                            <textarea
                                className="w-full p-4 bg-gray-900/50 text-white rounded-xl border border-gray-600 mb-4 font-mono text-sm"
                                rows="4"
                                placeholder="Paste up to 3 URLs (one per line)..."
                                value={urls}
                                onChange={(e) => setUrls(e.target.value)}
                            ></textarea>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white px-4 py-2">Cancel</button>
                                <button onClick={startBatch} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">Start Batch</button>
                            </div>
                        </React.Fragment>
                    )}

                    <div className="space-y-3 mt-4">
                        {items.map((item, idx) => (
                            <div key={idx} className="bg-gray-700/50 p-3 rounded-lg flex items-center justify-between border border-gray-600">
                                <div className="truncate flex-1 mr-4 text-left">
                                    <div className="text-xs text-gray-400">Video {idx + 1}</div>
                                    <div className="text-sm text-white truncate">{item.url}</div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-sm font-bold ${item.status.includes('Done') ? 'text-green-400' : item.status.includes('Failed') ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {item.status}
                                    </div>
                                    {item.result && (
                                        <a href={`/${item.result}`} download className="text-xs text-blue-400 hover:underline block mt-1">Download</a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {items.length > 0 && !processing && (
                        <button onClick={() => { setItems([]); setUrls(''); }} className="mt-4 text-sm text-gray-400 hover:text-white underline">Convert More</button>
                    )}
                </div>
            )}
        </div>
    );
}

// ==========================================
// COMPOSANT : FAQ
// ==========================================
function FAQ() {
    const [activeIndex, setActiveIndex] = React.useState(null);
    const questions = [
        { q: "Is it legal?", a: "For personal use only. Respect copyright laws." },
        { q: "Is it free?", a: `Yes, completely free with a daily limit of ${DAILY_LIMIT} videos.` },
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

// ==========================================
// COMPOSANT : ABOUT
// ==========================================
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
    const [themeColor, setThemeColor] = React.useState('#EF4444');
    const [currentPage, setCurrentPage] = React.useState('home');

    React.useEffect(() => {
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
                return (
                    <React.Fragment>
                        <Converter />
                        <BatchConverter />
                    </React.Fragment>
                );
            case 'faq': return <FAQ />;
            case 'about': return <About />;
            case 'eastereggs': return <EasterEggsPage />;
            default: return <Converter />;
        }
    };

    return (
        <div className="min-h-screen font-sans text-white flex flex-col">
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
                <p>&copy; 2025 YouTube to MP4. Built with React &amp; Flask.</p>
            </footer>
        </div>
    );
}

console.log('Mounting React App...');
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
