import { useEffect } from 'react';

/**
 * Custom hook to listen to the Quick Access refresh event and trigger a callback.
 * 
 * @param onRefresh Callback function to execute when the refresh event is triggered.
 */
export function useRefreshFrame(onRefresh: () => void | Promise<void>) {
  useEffect(() => {
    const handleRefresh = () => {
      void onRefresh();
    };

    window.addEventListener('optmamenu.refresh', handleRefresh);
    return () => {
      window.removeEventListener('optmamenu.refresh', handleRefresh);
    };
  }, [onRefresh]);
}
