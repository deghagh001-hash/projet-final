// Modules partagés avec la version React (static/js/react_app.jsx) et le build Vite (frontend/src).
import { showFullscreenLogo, triggerEasterEgg } from './shared/easter-eggs.js';
import { convertVideo, DEFAULT_FORMAT, filenameFromPath, triggerDownload } from './shared/convert-client.js';
import { consumeConversion, DAILY_LIMIT, readConversionsLeft } from './shared/daily-limit.js';

// =================================================================================
// Helper Functions
// =================================================================================

function logConversion(url) {
    if (localStorage.getItem('analyticsConsent') === 'accepted') {
        console.log('Conversion logged for:', url);
    }
}

// =================================================================================
// Core UI Functions
// =================================================================================

function showPage(pageId) {
    document.querySelectorAll('.separate-page').forEach(page => {
        page.classList.remove('active');
    });
    const targetPage = document.getElementById(pageId + '-page') || document.getElementById('home-page');
    targetPage.classList.add('active');
    window.scrollTo(0, 0);
    history.pushState(null, null, '#' + pageId);
}

function toggleCinemaMode() {
    document.body.classList.toggle('cinema-mode');
}

function setCustomTheme(color) {
    document.documentElement.style.setProperty('--accent-color', color);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', color);
    }

    let style = document.getElementById('theme-overrides');
    if (!style) {
        style = document.createElement('style');
        style.id = 'theme-overrides';
        document.head.appendChild(style);
    }

    style.innerHTML = `
        .text-red-500, .text-red-400 { color: ${color} !important; }
        .bg-red-600, .bg-red-500 { background-color: ${color} !important; }
        .hover\\:bg-red-700:hover { background-color: ${color} !important; filter: brightness(0.85); }
        .border-red-600 { border-color: ${color} !important; }
        .focus\\:ring-red-500:focus { --tw-ring-color: ${color} !important; }
        .lang-btn.active { color: ${color} !important; }
        .format-btn.selected { background-color: ${color} !important; border-color: ${color} !important; }
        .progress-step.active { background-color: ${color} !important; }
        .retro-title { filter: drop-shadow(0 0 10px ${color}) drop-shadow(0 0 20px ${color}); }
    `;

    localStorage.setItem('user-theme-color', color);
}

function initializeRatingSystem() {
    let currentRating = 0;
    const starButtons = document.querySelectorAll('.star-btn');

    function updateStars(rating) {
        starButtons.forEach(btn => {
            if (btn.dataset.rating <= rating) {
                btn.classList.remove('text-gray-600');
                btn.classList.add('text-yellow-400');
            } else {
                btn.classList.add('text-gray-600');
                btn.classList.remove('text-yellow-400');
            }
        });
    }

    starButtons.forEach(btn => {
        btn.addEventListener('mouseenter', () => updateStars(btn.dataset.rating));
        btn.addEventListener('mouseleave', () => updateStars(currentRating));
        btn.addEventListener('click', () => {
            currentRating = btn.dataset.rating;
            updateStars(currentRating);
            document.getElementById('rating-feedback').classList.remove('hidden');
        });
    });

    window.submitRating = function() {
        if (currentRating === 0) {
            alert('Please select a star rating first!');
            return;
        }
        const btn = document.querySelector('#rating-modal button[onclick="submitRating()"]');
        btn.textContent = 'Submitting...';
        btn.disabled = true;

        setTimeout(() => {
            btn.textContent = 'Thank You! ❤️';
            setTimeout(() => {
                closeRatingModal();
                btn.textContent = 'Submit Rating';
                btn.disabled = false;
                const footerRating = document.querySelector('.text-white.font-bold.text-xl');
                if(footerRating) footerRating.textContent = '4.9';
            }, 1000);
        }, 1000);
    }
}

function openRatingModal() {
    const modal = document.getElementById('rating-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
}

function closeRatingModal() {
    const modal = document.getElementById('rating-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// =================================================================================
// Initialization on DOMContentLoaded
// =================================================================================

document.addEventListener('DOMContentLoaded', function() {

    // Theme Initialization
    const savedColor = localStorage.getItem('user-theme-color');
    if (savedColor) {
        setCustomTheme(savedColor);
    }

    // Analytics Consent
    const consentKey = 'analyticsConsent';
    const consent = localStorage.getItem(consentKey);
    if (!consent) {
        document.getElementById('consent-banner').style.display = 'block';
    }
    window.analytics = {
        acceptConsent: () => { localStorage.setItem(consentKey, 'accepted'); document.getElementById('consent-banner').style.display = 'none'; },
        declineConsent: () => { localStorage.setItem(consentKey, 'declined'); document.getElementById('consent-banner').style.display = 'none'; }
    };

    // Platform and Format Selection
    document.querySelectorAll('.platform-icon').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.platform-icon').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            const platform = this.getAttribute('data-platform');
            const urlInput = document.getElementById('video-url');
            if (urlInput) {
                const placeholders = {
                    youtube: "Paste YouTube video URL here...",
                    tiktok: "Paste TikTok video URL here...",
                    instagram: "Paste Instagram URL here...",
                    twitch: "Paste Twitch clip URL here..."
                };
                urlInput.placeholder = placeholders[platform] || "Paste video URL here...";
            }
        });
    });

    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            const conversionFormatDisplay = document.getElementById('conversion-format');
            if (conversionFormatDisplay) {
                conversionFormatDisplay.textContent = this.textContent.trim();
            }
        });
    });

    // Select default format
    const defaultFormatBtn = document.querySelector('.format-btn[data-format="mp4-1080p"]');
    if (defaultFormatBtn) {
        defaultFormatBtn.classList.add('selected');
    }

    // Rating System
    initializeRatingSystem();

    // Initial call to set the number of conversions left
    updateConversionsLeft();

    // Initial Page Load based on Hash
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        showPage(hash);
    } else {
        showPage('home');
    }

    // FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const chevron = question.querySelector('.faq-chevron');
            const isOpening = !answer.style.maxHeight;

            document.querySelectorAll('.faq-answer').forEach(ans => ans.style.maxHeight = null);
            document.querySelectorAll('.faq-chevron').forEach(chev => chev.style.transform = 'rotate(0deg)');

            if (isOpening) {
                answer.style.maxHeight = answer.scrollHeight + "px";
                chevron.style.transform = 'rotate(180deg)';
            }
        });
    });

    // Easter Egg Detection
    const urlInput = document.getElementById('video-url');
    if (urlInput) {
        urlInput.addEventListener('input', function() {
            if (triggerEasterEgg(this.value)) {
                this.value = '';
            }
        });
    }

    // Fullscreen Logo Easter Egg
    const logoLink = document.querySelector('a.text-2xl.font-bold');
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            e.preventDefault();
            showFullscreenLogo({ confetti: window.confetti });
        });
    }

    // Old logo click logic removed or kept if needed for the image logo
    // let logoClickCount = 0; ...

    // =================================================================================
    // Event Listeners
    // =================================================================================

    document.querySelectorAll('a[data-page], button[data-page]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(el.getAttribute('data-page'));
        });
    });

    document.getElementById('mobile-menu')?.addEventListener('click', () => {
        document.getElementById('mobile-menu-content')?.classList.toggle('hidden');
    });

    document.querySelectorAll('button[data-color]').forEach(button => {
        button.addEventListener('click', () => setCustomTheme(button.dataset.color));
    });

    document.getElementById('accept-consent')?.addEventListener('click', window.analytics.acceptConsent);
    document.getElementById('decline-consent')?.addEventListener('click', window.analytics.declineConsent);
    document.getElementById('cinema-mode-btn')?.addEventListener('click', toggleCinemaMode);
    document.getElementById('open-rating-modal')?.addEventListener('click', openRatingModal);
    document.getElementById('close-rating-modal')?.addEventListener('click', closeRatingModal);
    document.getElementById('submit-rating')?.addEventListener('click', () => submitRating());
    document.getElementById('show-fullscreen-logo-footer')?.addEventListener('click', () => showFullscreenLogo({ confetti: window.confetti }));

    document.getElementById('footer-logo')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPage('home');
    });

    const audio = document.getElementById('bg-audio');
    if (audio) {
        audio.volume = 0.05;
    }
    const audioControlBtn = document.getElementById('audio-control-btn');
    const audioText = document.getElementById('audio-text');

    if (audioControlBtn && audioText) {
        audioControlBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                audioText.textContent = 'Mute';
                audioControlBtn.setAttribute('aria-label', 'Mute background audio');
            } else {
                audio.pause();
                audioText.textContent = 'Son';
                audioControlBtn.setAttribute('aria-label', 'Play background audio');
            }
        });
    }

    document.getElementById('convert-btn').addEventListener('click', () => {
        const url = document.getElementById('video-url').value;
        const errorContainer = document.getElementById('error-container');
        if (!url || !url.startsWith('https://')) {
            errorContainer.textContent = 'Please enter a valid URL starting with "https://".';
            errorContainer.classList.remove('hidden');
            return;
        }
        errorContainer.classList.add('hidden'); // Hide error if URL is valid
        startConversion(url);
    });
});

// =================================================================================
// Conversion Logic
// =================================================================================

// =================================================================================
// Conversion Logic & Batch Processing
// =================================================================================

let conversionsLeft;
let conversionCount = 0;

function updateConversionsLeft() {
    // On garde un affichage local pour l'UX, mais le serveur est le maître.
    conversionsLeft = readConversionsLeft();

    document.getElementById('conversions-left').textContent = conversionsLeft;
    const convertBtn = document.getElementById('convert-btn');
    const buttonText = convertBtn.querySelector('.button-text');
    
    // On ne désactive pas le bouton ici pour laisser le serveur gérer l'erreur 429
    // mais on affiche quand même l'info visuelle
    if (conversionsLeft <= 0) {
        buttonText.textContent = `Limit Reached (${DAILY_LIMIT}/${DAILY_LIMIT})`;
        document.getElementById('daily-limit-notice').classList.add('text-red-500');
    } else {
        buttonText.textContent = 'Convert';
        document.getElementById('daily-limit-notice').classList.remove('text-red-500');
    }
}

async function startConversion(url, isBatch = false, batchItemElement = null) {
    // UI Elements
    const progressBar = document.getElementById('conversion-progress-bar');
    const statusText = document.getElementById('conversion-status');
    const progressContainer = document.getElementById('conversion-progress-container');
    const convertBtn = document.getElementById('convert-btn');
    const resultCard = document.getElementById('result-card');
    const downloadBtn = document.getElementById('download-btn');
    const errorContainer = document.getElementById('error-container');
    const urlInput = document.getElementById('video-url');
    const urlContainer = urlInput?.parentElement;
    const formatButtons = document.querySelectorAll('.format-btn');
    const formatContainers = document.querySelectorAll('.format-btn')?.length > 0 ? 
        document.querySelectorAll('.format-btn')[0].closest('.grid')?.parentElement : null;

    // Reset UI for single conversion
    if (!isBatch) {
        errorContainer.classList.add('hidden');
        resultCard.style.display = 'none';
        
        // Hide URL input and format selection, show progress bar
        if (urlContainer) {
            urlContainer.style.display = 'none';
        }
        if (formatContainers) {
            formatContainers.style.display = 'none';
        }
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        statusText.textContent = 'Connecting to server...';
        convertBtn.disabled = true;
        convertBtn.classList.add('loading');
    } else if (batchItemElement) {
        // Update batch item UI
        batchItemElement.querySelector('.status').textContent = 'Starting...';
        batchItemElement.querySelector('.status').className = 'status text-yellow-400 text-sm';
    }

    const selectedFormatBtn = document.querySelector('.format-btn.selected');
    const format = selectedFormatBtn ? selectedFormatBtn.getAttribute('data-format') : DEFAULT_FORMAT;

    const onProgress = (percent, serverStatus) => {
        if (!isBatch) {
            progressBar.style.width = `${percent}%`;
            statusText.textContent = serverStatus || `Converting... ${Math.round(percent)}%`;
            document.getElementById('conversion-percentage').textContent = `${Math.round(percent)}%`;
        } else if (batchItemElement) {
            batchItemElement.querySelector('.status').textContent = `Downloading... ${Math.round(percent)}%`;
        }
    };

    const onComplete = (downloadPath) => {
        if (isBatch) {
            if (!batchItemElement) return;
            batchItemElement.querySelector('.status').textContent = 'Completed ✓';
            batchItemElement.querySelector('.status').className = 'status text-green-400 text-sm font-bold';

            const dlBtn = document.createElement('button');
            dlBtn.className = 'ml-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-colors';
            dlBtn.textContent = 'Download';
            dlBtn.onclick = () => triggerDownload(downloadPath);
            batchItemElement.appendChild(dlBtn);
            return;
        }

        progressBar.style.width = '100%';
        statusText.textContent = 'Conversion Complete!';

        // Update Limit
        consumeConversion();
        conversionCount++;
        updateConversionsLeft();

        if (conversionCount === 3) setTimeout(openRatingModal, 1500);

        setTimeout(() => {
            progressContainer.style.display = 'none';

            // Show result card immediately (do not restore inputs yet)
            resultCard.style.display = 'block';

            const filenameDisplay = document.getElementById('result-filename');
            if (filenameDisplay) {
                filenameDisplay.textContent = filenameFromPath(downloadPath);
            }

            const resetUI = () => {
                resultCard.style.display = 'none';
                if (urlContainer) urlContainer.style.display = 'flex';
                if (formatContainers) formatContainers.style.display = 'block';
                convertBtn.disabled = false;
                convertBtn.classList.remove('loading');
                if (urlInput) urlInput.value = '';
            };

            downloadBtn.onclick = () => {
                triggerDownload(downloadPath);
                // Restore UI after download starts (60 seconds delay)
                setTimeout(resetUI, 60000);
            };

            const convertAnotherBtn = document.getElementById('convert-another-btn');
            if (convertAnotherBtn) {
                convertAnotherBtn.onclick = resetUI;
            }

            logConversion(url);
        }, 1000);
    };

    try {
        await convertVideo({ url, format, onProgress, onComplete });
    } catch (error) {
        console.error('Conversion Error:', error);
        if (!isBatch) {
            progressContainer.style.display = 'none';
            
            // Show URL input again on error
            if (urlContainer) {
                urlContainer.style.display = 'flex';
            }
            
            // Show format buttons again
            if (formatContainers) {
                formatContainers.style.display = 'block';
            }
            
            convertBtn.disabled = false;
            convertBtn.classList.remove('loading');
            
            errorContainer.textContent = `Error: ${error.message}`;
            errorContainer.classList.remove('hidden');
        } else if (batchItemElement) {
            batchItemElement.querySelector('.status').textContent = 'Failed ❌';
            batchItemElement.querySelector('.status').className = 'status text-red-500 text-sm font-bold';
            const errSpan = document.createElement('div');
            errSpan.className = 'text-xs text-red-400 mt-1';
            errSpan.textContent = error.message;
            batchItemElement.appendChild(errSpan);
        }
    } finally {
        if (!isBatch) {
            convertBtn.disabled = false;
            convertBtn.classList.remove('loading');
        }
    }
}

// =================================================================================
// Batch Convert Logic
// =================================================================================

function initBatchConvert() {
    const toggleBtn = document.getElementById('toggle-batch-btn');
    const container = document.getElementById('batch-container');
    const startBtn = document.getElementById('start-batch-btn');
    const cancelBtn = document.getElementById('cancel-batch-btn');
    const urlsInput = document.getElementById('batch-urls');
    const progressArea = document.getElementById('batch-progress-area');
    const limitWarning = document.getElementById('batch-limit-warning');

    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        container.classList.remove('hidden');
        toggleBtn.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', () => {
        container.classList.add('hidden');
        toggleBtn.classList.remove('hidden');
        progressArea.innerHTML = '';
        progressArea.classList.add('hidden');
        urlsInput.value = '';
    });

    startBtn.addEventListener('click', async () => {
        const urls = urlsInput.value.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        
        if (urls.length === 0) {
            alert('Please enter at least one URL.');
            return;
        }
        if (urls.length > 3) {
            alert('Maximum 3 videos allowed for batch conversion.');
            return;
        }

        // Check limits
        if (conversionsLeft < urls.length) {
            limitWarning.textContent = `You only have ${conversionsLeft} conversions left today.`;
            limitWarning.classList.remove('hidden');
            return;
        }
        limitWarning.classList.add('hidden');

        // UI Setup
        startBtn.disabled = true;
        urlsInput.disabled = true;
        progressArea.innerHTML = '';
        progressArea.classList.remove('hidden');

        // Create UI rows for each video
        const itemElements = [];
        urls.forEach((url, index) => {
            const div = document.createElement('div');
            div.className = 'bg-gray-700/50 p-3 rounded-lg flex items-center justify-between border border-gray-600';
            div.innerHTML = `
                <div class="truncate flex-1 mr-4">
                    <span class="text-xs text-gray-400 block">Video ${index + 1}</span>
                    <span class="text-sm text-white truncate block w-full">${url}</span>
                </div>
                <div class="status text-gray-300 text-sm">Pending...</div>
            `;
            progressArea.appendChild(div);
            itemElements.push({ url, element: div });
        });

        // Process sequentially
        for (const item of itemElements) {
            await startConversion(item.url, true, item.element);
        }

        startBtn.disabled = false;
        urlsInput.disabled = false;
    });
}

// Initialize Batch Logic on Load
document.addEventListener('DOMContentLoaded', () => {
    initBatchConvert();
});
