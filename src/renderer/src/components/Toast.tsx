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
      className="sheen fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 animate-in items-center gap-4 rounded-full border border-hairline/10 bg-glass/70 px-5 py-2.5 text-sm whitespace-nowrap backdrop-blur-2xl backdrop-saturate-150 fade-in slide-in-from-bottom-2"
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
