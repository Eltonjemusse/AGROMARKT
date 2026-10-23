// Form validation stays inline; operational failures use persistent notifications.
export function reportOperationError(error, { notify, fallback, onFormError, onFieldError }) {
  const candidate = error?.field ? error.message : error?.response?.data?.message;
  const message = typeof candidate === 'string' && candidate.trim() ? candidate : fallback;
  if (error?.field && onFieldError) {
    onFieldError(error.field, message);
  } else if ([400, 422].includes(error?.response?.status) && onFormError) {
    onFormError(message);
  } else {
    notify.error(message);
  }
}
