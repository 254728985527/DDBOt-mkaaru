const PUBLIC_MARKET_DATA_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';
const REQUEST_TIMEOUT = 8000;

const normalizeSymbols = payload => {
    const symbols =
        payload?.active_symbols || payload?.symbols || payload?.market_data?.symbols || payload?.data?.symbols;
    if (!Array.isArray(symbols)) return [];

    return symbols
        .map(symbol => ({
            ...symbol,
            symbol: symbol.symbol || symbol.code || symbol.id,
            display_name: symbol.display_name || symbol.name || symbol.symbol || symbol.code,
            market: symbol.market || symbol.market_code || symbol.market_name || 'synthetic_index',
            market_display_name:
                symbol.market_display_name || symbol.market_name || symbol.market || 'Synthetic Indices',
            submarket: symbol.submarket || symbol.submarket_code || symbol.submarket_name || 'random_index',
            submarket_display_name:
                symbol.submarket_display_name || symbol.submarket_name || symbol.submarket || 'Volatility Indices',
        }))
        .filter(symbol => symbol.symbol);
};

class PublicMarketData {
    socket = null;
    state = 'CLOSED';
    request_id = 0;
    pending = new Map();
    active_symbols = [];
    contracts = new Map();
    reconnect_attempts = 0;
    reconnect_timer = null;
    connect_promise = null;

    connect = () => {
        if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
        if (this.connect_promise) return this.connect_promise;

        this.state = 'CONNECTING';
        this.connect_promise = new Promise((resolve, reject) => {
            const socket = new WebSocket(PUBLIC_MARKET_DATA_URL);
            this.socket = socket;
            const timeout = window.setTimeout(() => {
                socket.close();
                reject(new Error('Public market-data connection timed out'));
            }, REQUEST_TIMEOUT);

            socket.addEventListener(
                'open',
                () => {
                    window.clearTimeout(timeout);
                    this.state = 'OPEN';
                    this.reconnect_attempts = 0;
                    resolve();
                },
                { once: true }
            );
            socket.addEventListener('message', event => this.handleMessage(event));
            socket.addEventListener(
                'error',
                () => {
                    this.state = 'CLOSED';
                    reject(new Error('Public market-data connection failed'));
                },
                { once: true }
            );
            socket.addEventListener('close', () => {
                this.state = 'CLOSED';
                this.connect_promise = null;
                this.scheduleReconnect();
            });
        }).finally(() => {
            this.connect_promise = null;
        });

        return this.connect_promise;
    };

    scheduleReconnect = () => {
        if (this.reconnect_timer || this.reconnect_attempts >= 5) return;
        const delay = Math.min(1000 * 2 ** this.reconnect_attempts, 16000);
        this.reconnect_attempts += 1;
        this.reconnect_timer = window.setTimeout(() => {
            this.reconnect_timer = null;
            this.loadActiveSymbols().catch(() => undefined);
        }, delay);
    };

    handleMessage = event => {
        let payload;
        try {
            payload = JSON.parse(event.data);
        } catch {
            return;
        }

        const pending = payload.req_id && this.pending.get(payload.req_id);
        if (pending) {
            this.pending.delete(payload.req_id);
            window.clearTimeout(pending.timeout);
            if (payload.error) pending.reject(payload.error);
            else pending.resolve(payload);
        }

        const symbols = normalizeSymbols(payload);
        if (symbols.length) this.active_symbols = symbols;
        if (payload.contracts_for?.available)
            this.contracts.set(payload.echo_req?.contracts_for, payload.contracts_for.available);
    };

    request = async request => {
        await this.connect();
        const req_id = ++this.request_id;
        return new Promise((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                this.pending.delete(req_id);
                reject(new Error('Public market-data request timed out'));
            }, REQUEST_TIMEOUT);
            this.pending.set(req_id, { resolve, reject, timeout });
            this.socket.send(JSON.stringify({ ...request, req_id }));
        });
    };

    loadActiveSymbols = async () => {
        try {
            const response = await this.request({ active_symbols: 'brief' });
            const symbols = normalizeSymbols(response);
            if (symbols.length) this.active_symbols = symbols;
        } catch (error) {
            console.warn('[MARKET DATA] Public symbols unavailable:', error);
        }
        return this.active_symbols;
    };

    getContracts = async symbol => {
        if (!symbol) return [];
        if (this.contracts.has(symbol)) return this.contracts.get(symbol);
        try {
            const response = await this.request({ contracts_for: symbol });
            const contracts = response.contracts_for?.available || [];
            this.contracts.set(symbol, contracts);
            return contracts;
        } catch (error) {
            console.warn('[MARKET DATA] Public contracts unavailable:', error);
            return [];
        }
    };

    dispose = () => {
        if (this.reconnect_timer) window.clearTimeout(this.reconnect_timer);
        this.reconnect_timer = null;
        this.pending.forEach(({ reject, timeout }) => {
            window.clearTimeout(timeout);
            reject(new Error('Public market-data connection disposed'));
        });
        this.pending.clear();
        this.socket?.close();
        this.socket = null;
        this.state = 'CLOSED';
    };
}

export const public_market_data = new PublicMarketData();
export { PUBLIC_MARKET_DATA_URL };
export default public_market_data;
