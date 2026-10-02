import { generateDerivApiInstance } from './appId';

class ChartAPI {
    api;
    reconnectPromise;
    reconnectAttempts = 0;
    time_interval;

    onsocketclose = () => {
        this.reconnectIfNotConnected();
    };

    waitForConnectionOpen = (connection, timeout = 5000) => {
        if (!connection) return Promise.reject(new Error('Chart WebSocket is unavailable'));
        if (connection.readyState === WebSocket.OPEN) return Promise.resolve();

        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                connection.removeEventListener('open', handleOpen);
                connection.removeEventListener('error', handleError);
                connection.removeEventListener('close', handleClose);
                callback(value);
            };
            const handleOpen = () => {
                console.log('[CHART] WebSocket connected');
                finish(resolve);
            };
            const handleError = () => finish(reject, new Error('Chart WebSocket connection failed'));
            const handleClose = () => finish(reject, new Error('Chart WebSocket closed before opening'));
            const timeoutId = window.setTimeout(
                () => finish(reject, new Error('Chart WebSocket connection timed out')),
                timeout
            );

            connection.addEventListener('open', handleOpen, { once: true });
            connection.addEventListener('error', handleError, { once: true });
            connection.addEventListener('close', handleClose, { once: true });
        });
    };

    init = async (force_create_connection = false) => {
        const readyState = this.api?.connection?.readyState;
        if (!force_create_connection && readyState === WebSocket.OPEN) return this.api;
        if (this.reconnectPromise) return this.reconnectPromise;

        this.reconnectPromise = (async () => {
            if (this.api?.connection && readyState !== WebSocket.OPEN) {
                this.api.connection.removeEventListener('close', this.onsocketclose);
                this.api.disconnect();
            }

            let nextApi = await generateDerivApiInstance('wss://api.derivws.com/trading/v1/options/ws/public');
            try {
                await this.waitForConnectionOpen(nextApi?.connection, 10000);
            } catch (publicError) {
                console.warn('[CHART] Public market-data socket unavailable; using the Deriv chart socket.');
                nextApi?.disconnect?.();
                try {
                    nextApi = await generateDerivApiInstance();
                    await this.waitForConnectionOpen(nextApi?.connection, 10000);
                } catch {
                    console.warn('[CHART] Chart data is temporarily unavailable.');
                    nextApi?.disconnect?.();
                    return null;
                }
            }

            this.api = nextApi;
            this.api?.connection?.addEventListener('close', this.onsocketclose);
            this.reconnectAttempts = 0;
            this.getTime();
            return this.api;
        })().finally(() => {
            this.reconnectPromise = undefined;
        });

        return this.reconnectPromise;
    };

    ensureReady = async () => {
        const connection = this.api?.connection;
        if (connection?.readyState === WebSocket.OPEN) return this.api;

        const api = await this.init(
            connection?.readyState === WebSocket.CLOSING || connection?.readyState === WebSocket.CLOSED
        );
        if (!api?.connection) return null;
        if (api.connection.readyState !== WebSocket.OPEN) {
            try {
                await this.waitForConnectionOpen(api.connection, 10000);
            } catch {
                return null;
            }
        }
        return api;
    };

    getTime() {
        if (!this.time_interval) {
            this.time_interval = setInterval(() => {
                if (this.api?.connection?.readyState === WebSocket.OPEN) this.api.send({ time: 1 });
            }, 30000);
        }
    }

    reconnectIfNotConnected = () => {
        const readyState = this.api?.connection?.readyState;
        console.log('[CHART] API connection state:', readyState);
        if (readyState === WebSocket.OPEN || this.reconnectAttempts >= 3) return;
        this.reconnectAttempts += 1;
        console.log('[CHART] reconnecting');
        this.init(true).catch(error => console.error('[CHART] chart initialization failed:', error));
    };
}

const chart_api = new ChartAPI();

export default chart_api;
