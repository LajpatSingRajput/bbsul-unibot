"use client";
import { useEffect, useRef } from "react";
import { X, Search, Inbox, LoaderCircle } from "lucide-react";
export function Field({ label, children, ...props }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Badge({ children, tone = "green" }: any) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title = "Nothing here yet",
  children,
  icon: Icon = Inbox,
}: any) {
  return (
    <div className="empty">
      <Icon size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function SearchBox({ value, onChange, placeholder = "Search…" }: any) {
  return (
    <div className="search">
      <Search size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Spinner() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Loading…
    </div>
  );
}
export function Modal({ title, children, onClose }: any) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({ title, onConfirm, onClose }: any) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>This action cannot be undone.</p>
      <div className="form-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn danger" onClick={onConfirm}>
          Delete
        </button>
      </div>
    </Modal>
  );
}
export const date = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
