import { createContext, useContext } from 'react';

export const NotificationContext = createContext(null);

export function useNotifications() {
  const notifications = useContext(NotificationContext);
  if (!notifications) throw new Error('As notificações precisam de NotificationProvider.');
  return notifications;
}
