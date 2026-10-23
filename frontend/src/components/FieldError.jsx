function FieldError({ id, message }) {
  return message ? <p id={id} className="field-error" role="alert">{message}</p> : null;
}

export default FieldError;
