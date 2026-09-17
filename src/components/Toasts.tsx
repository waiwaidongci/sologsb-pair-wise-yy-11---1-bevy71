export type ToastKind = "info" | "success" | "error";

export interface ToastData {
  id: number;
  kind: ToastKind;
  message: string;
}

export default function Toasts({ toasts }: { toasts: ToastData[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
