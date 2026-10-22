function DeleteAction({ reason, onDelete }) {
  return (
    <div>
      <button type="button" className="danger-btn" onClick={onDelete} disabled={Boolean(reason)} title={reason || undefined}>Apagar</button>
      {reason && <p className="field-help">{reason}</p>}
    </div>
  );
}

export default DeleteAction;
