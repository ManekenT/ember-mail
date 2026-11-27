import { useEffect } from 'react'

export interface ToastMessage {
  id: number
  text: string
  onUndo?: () => void
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps): React.JSX.Element | null {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 animate-in items-center gap-4 rounded-lg border bg-card px-4 py-3 text-sm whitespace-nowrap shadow-xl shadow-black/40 fade-in slide-in-from-bottom-2"
    >
      <span>{toast.text}</span>
      {toast.onUndo && (
        <button
          type="button"
          className="font-semibold text-ember hover:underline"
          onClick={() => {
            toast.onUndo?.()
            onDismiss()
          }}
        >
          Undo
        </button>
      )}
    </div>
  )
}
