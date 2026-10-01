import ReactDOM from 'react-dom/client';
import { AuthWrapper } from './app/AuthWrapper';

const CHUNK_RELOAD_KEY = 'deriv-chunk-reload-attempt';

const isChunkLoadError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return /Loading (CSS )?chunk|ChunkLoadError|failed to fetch dynamically imported module|import\(\)/i.test(message);
};

const recoverFromChunkLoadError = (error: unknown) => {
    if (!isChunkLoadError(error)) return;

    try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
            window.location.reload();
            return;
        }

        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        console.error('[Chunk Recovery] A generated application chunk could not be loaded after one reload.', error);
    } catch {
        console.error('[Chunk Recovery] Unable to recover from a generated chunk load failure.', error);
    }
};

window.addEventListener('error', event => recoverFromChunkLoadError(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => recoverFromChunkLoadError(event.reason));

// Clear the guard only after the app has remained loaded long enough for lazy
// routes and their async styles to initialize. This prevents reload loops.
window.setTimeout(() => {
    try {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
        // Session storage may be unavailable in privacy-restricted browsers.
    }
}, 10000);
import { AnalyticsInitializer } from './utils/analytics';
import { registerPWA } from './utils/pwa-utils';
import './styles/index.scss';

AnalyticsInitializer();
registerPWA()
    .then(registration => {
        if (registration) {
            console.log('PWA service worker registered successfully for Chrome');
        } else {
            console.log('PWA service worker disabled for non-Chrome browser');
        }
    })
    .catch(error => {
        console.error('PWA service worker registration failed:', error);
    });

ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
