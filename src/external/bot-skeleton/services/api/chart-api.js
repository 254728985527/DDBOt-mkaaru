import { generateDerivApiInstance } from './appId';

class ChartAPI {
    api;
    reconnectPromise;
    reconnectAttempts = 0;
    time_interval;

    onsocketclose = () => {
        this.reconnectIfNotConnected();
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
            this.api = await generateDerivApiInstance();
            this.api?.connection?.addEventListener('close', this.onsocketclose);
            this.reconnectAttempts = 0;
            this.getTime();
            return this.api;
        })().finally(() => {
            this.reconnectPromise = undefined;
        });

        return this.reconnectPromise;
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
