export interface ToastData {
  type: "info" | "success" | "warn" | "error";
  message: string;
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.type}`} role="status">{toast.message}</div>;
}
