import { useEffect, useState, useSyncExternalStore } from 'react';
import { NotificationContext } from './NotificationContext';
import { createNotificationStore } from './notificationStore';
import NotificationViewport from './NotificationViewport';

function NotificationProvider({ children, store: suppliedStore }) {
  const [store] = useState(() => suppliedStore || createNotificationStore());
  const notifications = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    const onVisibility = () => store.setHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [store]);

  return (
    <NotificationContext.Provider value={store.notify}>
      {children}
      <NotificationViewport notifications={notifications} onDismiss={store.dismiss} onPause={store.pause} onResume={store.resume} />
    </NotificationContext.Provider>
  );
}

export default NotificationProvider;
