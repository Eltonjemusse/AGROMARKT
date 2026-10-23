import { useId } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const variants = {
  success: { label: 'Sucesso', Icon: CheckCircle2 },
  error: { label: 'Erro', Icon: AlertTriangle },
  info: { label: 'Informação', Icon: Info },
};

function NotificationViewport({ notifications, onDismiss, onPause, onResume }) {
  const prefix = useId();
  const renderNotification = (notification) => {
    const { label, Icon } = variants[notification.type];
    const messageId = `${prefix}-${notification.id}`;
    return (
      <li key={notification.id} className={`notification notification--${notification.type}`} aria-atomic="true"
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') onPause(notification.id, 'pointer'); }}
        onPointerLeave={() => onResume(notification.id, 'pointer')}
        onFocusCapture={() => onPause(notification.id, 'focus')}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onResume(notification.id, 'focus'); }}>
        <Icon className="notification-icon" size={24} aria-hidden="true" />
        <div className="notification-content">
          <strong>{label}</strong>
          <p id={messageId}>{notification.message}</p>
        </div>
        <button type="button" className="notification-close" onClick={() => onDismiss(notification.id)}
          aria-label={`Fechar notificação: ${label}`} aria-describedby={messageId}>
          <X size={20} aria-hidden="true" />
        </button>
      </li>
    );
  };
  return (
    <section className="notification-stack" aria-label="Notificações">
      {/* Live regions exist before the first message; removals are not announced. */}
      <div role="alert" aria-live="assertive" aria-atomic="false" aria-relevant="additions text">
        <ul className="notification-list">{notifications.filter((item) => item.type === 'error').map(renderNotification)}</ul>
      </div>
      <div role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions text">
        <ul className="notification-list">{notifications.filter((item) => item.type !== 'error').map(renderNotification)}</ul>
      </div>
    </section>
  );
}

export default NotificationViewport;
