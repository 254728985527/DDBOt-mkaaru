import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import { useStore } from '@/hooks/useStore';
import {
    ActiveSymbolsRequest,
    ServerTimeRequest,
    TicksHistoryResponse,
    TicksStreamRequest,
    TradingTimesRequest,
} from '@deriv/api-types';
import { ChartTitle, SmartChart } from '@deriv/deriv-charts';
import { useDevice } from '@deriv-com/ui';
import ToolbarWidgets from './toolbar-widgets';
import '@deriv/deriv-charts/dist/smartcharts.css';

type TSubscription = {
    unsubscribe?: () => void;
};

const withTimeout = <T,>(promise: Promise<T>, timeout = 5000): Promise<T> =>
    Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(new Error('Chart API request timed out')), timeout);
        }),
    ]);

const Chart = observer(({ show_digits_stats }: { show_digits_stats: boolean }) => {
    const barriers: [] = [];
    const { common, ui } = useStore();
    const { chart_store, run_panel, dashboard } = useStore();
    const [isSafari, setIsSafari] = useState(false);
    const [chartConnectionMessage, setChartConnectionMessage] = useState('');

    const {
        chart_type,
        getMarketsOrder,
        granularity,
        onSymbolChange,
        setChartStatus,
        symbol,
        updateChartType,
        updateGranularity,
        updateSymbol,
        setChartSubscriptionId,
        chart_subscription_id,
    } = chart_store;
    const chartSubscriptionIdRef = useRef(chart_subscription_id);
    const streamSubscriptionRef = useRef<TSubscription | null>(null);
    const requestVersionRef = useRef(0);
    const { isDesktop, isMobile } = useDevice();
    const { is_drawer_open } = run_panel;
    const { is_chart_modal_visible } = dashboard;
    const settings = {
        assetInformation: false, // ui.is_chart_asset_info_visible,
        countdown: true,
        isHighestLowestMarkerEnabled: false, // TODO: Pending UI,
        language: common.current_language.toLowerCase(),
        position: ui.is_chart_layout_default ? 'bottom' : 'left',
        theme: ui.is_dark_mode_on ? 'dark' : 'light',
    };
    useEffect(() => {
        // Safari browser detection
        const isSafariBrowser = () => {
            const ua = navigator.userAgent.toLowerCase();
            return ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1 && ua.indexOf('android') === -1;
        };

        setIsSafari(isSafariBrowser());

        chart_api.init().catch(error => console.error('[CHART] chart initialization failed:', error));

        return () => {
            requestVersionRef.current += 1;
            streamSubscriptionRef.current?.unsubscribe?.();
            streamSubscriptionRef.current = null;
            requestForgetStream(chartSubscriptionIdRef.current);
        };
    }, []);

    useEffect(() => {
        chartSubscriptionIdRef.current = chart_subscription_id;
    }, [chart_subscription_id]);

    useEffect(() => {
        if (!symbol) updateSymbol();
    }, [symbol, updateSymbol]);

    const requestAPI = async (req: ServerTimeRequest | ActiveSymbolsRequest | TradingTimesRequest) => {
        if (chart_api.api?.connection?.readyState !== WebSocket.OPEN) {
            console.warn('[CHART] WebSocket not ready');
            await chart_api.init();
        }
        if (chart_api.api?.connection?.readyState !== WebSocket.OPEN) throw new Error('Chart WebSocket is not ready');
        return withTimeout(chart_api.api.send(req));
    };
    const requestForgetStream = (subscription_id: string) => {
        streamSubscriptionRef.current?.unsubscribe?.();
        streamSubscriptionRef.current = null;
        if (subscription_id && chart_api.api?.connection?.readyState === WebSocket.OPEN) {
            chart_api.api.forget(subscription_id);
        }
        chartSubscriptionIdRef.current = '';
        setChartSubscriptionId('');
    };

    const requestSubscribe = async (req: TicksStreamRequest, callback: (data: any) => void) => {
        const requestVersion = ++requestVersionRef.current;
        requestForgetStream(chartSubscriptionIdRef.current);
        try {
            if (chart_api.api?.connection?.readyState !== WebSocket.OPEN) {
                console.warn('[CHART] WebSocket not ready');
                await chart_api.init();
            }
            if (requestVersion !== requestVersionRef.current) return;
            if (chart_api.api?.connection?.readyState !== WebSocket.OPEN) {
                setChartConnectionMessage('Chart connection is unavailable. Retry the chart request.');
                callback([]);
                return;
            }
            console.log('[CHART] Requesting history:', req);
            const history = await withTimeout(chart_api.api.send(req), 5000);
            if (requestVersion !== requestVersionRef.current) return;
            console.log('[CHART] History received:', history);
            setChartConnectionMessage('');
            const subscriptionId = history?.subscription?.id ?? '';
            chartSubscriptionIdRef.current = subscriptionId;
            setChartSubscriptionId(subscriptionId);
            if (history) callback(history);
            if (req.subscribe === 1 && subscriptionId) {
                streamSubscriptionRef.current =
                    chart_api.api.onMessage()?.subscribe(({ data }: { data: TicksHistoryResponse }) => {
                        if (requestVersion === requestVersionRef.current) callback(data);
                    }) ?? null;
            }
        } catch (error) {
            if (requestVersion !== requestVersionRef.current) return;
            console.error('[CHART] History request failed:', error);
            setChartConnectionMessage('Chart data could not be loaded. Retry the chart request.');
            callback([]);
        }
    };

    if (!symbol) {
        return <div className='dashboard__chart-wrapper chart-loading-state'>Loading market chart...</div>;
    }
    const is_connection_opened = chart_api?.api?.connection?.readyState === WebSocket.OPEN;
    return (
        <div
            className={classNames('dashboard__chart-wrapper', {
                'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                'dashboard__chart-wrapper--safari': isSafari,
            })}
            dir='ltr'
        >
            {chartConnectionMessage && (
                <div className='chart-connection-message' role='status'>
                    {chartConnectionMessage}
                </div>
            )}
            <SmartChart
                id='dbot'
                barriers={barriers}
                showLastDigitStats={show_digits_stats}
                chartControlsWidgets={null}
                enabledChartFooter={false}
                chartStatusListener={(v: boolean) => setChartStatus(!v)}
                toolbarWidget={() => (
                    <ToolbarWidgets
                        updateChartType={updateChartType}
                        updateGranularity={updateGranularity}
                        position={!isDesktop ? 'bottom' : 'top'}
                        isDesktop={isDesktop}
                    />
                )}
                chartType={chart_type}
                isMobile={isMobile}
                enabledNavigationWidget={isDesktop}
                granularity={granularity}
                requestAPI={requestAPI}
                requestForget={requestForgetStream}
                requestForgetStream={requestForgetStream}
                requestSubscribe={requestSubscribe}
                settings={settings}
                symbol={symbol}
                topWidgets={() => <ChartTitle onChange={onSymbolChange} />}
                isConnectionOpened={is_connection_opened}
                getMarketsOrder={getMarketsOrder}
                isLive
                leftMargin={80}
            />
        </div>
    );
});

export default Chart;
