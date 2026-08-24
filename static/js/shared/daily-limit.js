// Suivi local du quota quotidien (le serveur reste maître, cf. DAILY_LIMIT dans app.py).

export const DAILY_LIMIT = 8;

const COUNT_KEY = 'conversionsLeft';
const DATE_KEY = 'lastConversionDate';

function save(value) {
    localStorage.setItem(COUNT_KEY, value);
    return value;
}

/** Nombre de conversions restantes aujourd'hui, réinitialisé au changement de jour. */
export function readConversionsLeft() {
    const today = new Date().toDateString();
    if (localStorage.getItem(DATE_KEY) !== today) {
        localStorage.setItem(DATE_KEY, today);
        return save(DAILY_LIMIT);
    }
    const stored = localStorage.getItem(COUNT_KEY);
    return stored === null ? save(DAILY_LIMIT) : parseInt(stored, 10);
}

/** Décrémente le quota après une conversion réussie et renvoie le reste. */
export function consumeConversion() {
    return save(Math.max(0, readConversionsLeft() - 1));
}

if (typeof window !== 'undefined') {
    window.DailyLimit = { DAILY_LIMIT, readConversionsLeft, consumeConversion };
}
