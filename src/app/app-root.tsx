import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import ErrorBoundary from '@/components/error-component/error-boundary';
import ErrorComponent from '@/components/error-component/error-component';
import ChunkLoader from '@/components/loader/chunk-loader';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import useTMB from '@/hooks/useTMB';
import { localize } from '@deriv-com/translations';
import './app-root.scss';

const AppContent = lazy(() => import('./app-content'));

const AppRootLoader = () => {
    return <ChunkLoader message={localize('Loading...')} />;
};

const ErrorComponentWrapper = observer(() => {
    const { common } = useStore();

    if (!common.error) return null;

    return (
        <ErrorComponent
            header={common.error?.header}
            message={common.error?.message}
            redirect_label={common.error?.redirect_label}
            redirectOnClick={common.error?.redirectOnClick}
            should_clear_error_on_click={common.error?.should_clear_error_on_click}
            setError={common.setError}
            redirect_to={common.error?.redirect_to}
            should_redirect={common.error?.should_redirect}
        />
    );
});

const AppRoot = () => {
    const store = useStore();
    const api_base_initialized = useRef(false);
    const [is_api_initialized, setIsApiInitialized] = useState(false);
    const [is_tmb_check_complete, setIsTmbCheckComplete] = useState(false);
    const [, setIsTmbEnabled] = useState(false);
    const { isTmbEnabled } = useTMB();

    // Remote configuration is optional and must never prevent the application from rendering.
    useEffect(() => {
        let cancelled = false;
        const checkTmbStatus = async () => {
            try {
                const tmb_status = await isTmbEnabled();
                if (!cancelled) {
                    setIsTmbEnabled(tmb_status);
                }
            } catch (error) {
                console.error('[TMB] initialization failed:', error);
                if (!cancelled) setIsTmbEnabled(false);
            } finally {
                if (!cancelled) setIsTmbCheckComplete(true);
            }
        };

        checkTmbStatus();
        const timeoutId = window.setTimeout(() => {
            console.warn('[TMB] remote configuration timeout');
            if (!cancelled) {
                setIsTmbEnabled(false);
                setIsTmbCheckComplete(true);
            }
        }, 3500);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [isTmbEnabled]);

    // API initialization is also best-effort; the UI remains usable when it is unavailable.
    useEffect(() => {
        if (!is_tmb_check_complete) return;

        let cancelled = false;
        console.log('[API] initialization started');
        const initializeApi = async () => {
            try {
                if (!api_base_initialized.current) {
                    await Promise.race([
                        api_base.init(),
                        new Promise<never>((_, reject) =>
                            window.setTimeout(() => reject(new Error('API initialization timeout')), 5000)
                        ),
                    ]);
                    api_base_initialized.current = true;
                    console.log('[API] initialization completed');
                }
            } catch (error) {
                console.error('[API] initialization failed:', error);
            } finally {
                if (!cancelled) setIsApiInitialized(true);
            }
        };

        initializeApi();
        return () => {
            cancelled = true;
        };
    }, [is_tmb_check_complete]);

    // Independent guard for any initialization path that stalls.
    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            if (!is_api_initialized) {
                console.warn('[APP] initialization timeout');
                console.warn('[APP] continuing without authentication');
                setIsTmbEnabled(false);
                setIsTmbCheckComplete(true);
                setIsApiInitialized(true);
            }
        }, 5000);

        return () => window.clearTimeout(timeoutId);
    }, [is_api_initialized]);

    if (!store || !is_api_initialized) return <AppRootLoader />;

    return (
        <Suspense fallback={<AppRootLoader />}>
            <ErrorBoundary root_store={store}>
                <ErrorComponentWrapper />
                <AppContent />
            </ErrorBoundary>
        </Suspense>
    );
};

export default AppRoot;
