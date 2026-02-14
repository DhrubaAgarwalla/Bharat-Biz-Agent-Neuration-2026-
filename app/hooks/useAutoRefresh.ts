// Auto-refresh hook for background data fetching
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface UseAutoRefreshOptions {
    interval?: number; // in milliseconds, default 30 seconds
    refreshOnFocus?: boolean; // refresh when app comes to foreground
}

export function useAutoRefresh(
    fetchFunction: () => Promise<void>,
    options: UseAutoRefreshOptions = {}
) {
    const { interval = 30000, refreshOnFocus = true } = options;
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appState = useRef(AppState.currentState);

    const refresh = useCallback(async () => {
        try {
            await fetchFunction();
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }, [fetchFunction]);

    useEffect(() => {
        // Initial fetch
        refresh();

        // Set up interval for background refresh
        intervalRef.current = setInterval(refresh, interval);

        // App state listener for refresh on focus
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (
                refreshOnFocus &&
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                refresh();
            }
            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            subscription?.remove();
        };
    }, [refresh, interval, refreshOnFocus]);

    return { refresh };
}
