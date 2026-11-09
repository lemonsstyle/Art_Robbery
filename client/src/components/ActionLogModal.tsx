import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";

export interface LogEntry {
  key: number;
  text: string;
}

interface ActionLogModalProps {
  open: boolean;
  entries: LogEntry[];
  onClose: () => void;
}

export function ActionLogModal({ open, entries, onClose }: ActionLogModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal log-modal" role="dialog" aria-modal="true" aria-labelledby="log-title">
        <header className="modal__head">
          <div>
            <p className="eyebrow">TABLE LOG</p>
            <h2 id="log-title">最近动作</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭记录"
            ref={closeRef}
          >
            <CloseIcon />
          </button>
        </header>

        {entries.length === 0 ? (
          <p className="log-empty">还没有动作。打出一张牌，这里会按顺序记下来。</p>
        ) : (
          <ol className="log-list">
            {entries.map((entry, index) => (
              <li className="log-entry" key={entry.key}>
                <span className="log-entry__index">{String(index + 1).padStart(2, "0")}</span>
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
