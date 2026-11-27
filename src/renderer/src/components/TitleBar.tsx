import { EmberLogo } from '@renderer/components/EmberLogo'
import { cn } from '@renderer/lib/utils'

/**
 * The window's title bar, drawn by the app so it sits on the ambient glow. The whole bar
 * drags the window; the native window buttons are overlaid on the right (Windows, Linux)
 * or left (macOS) by Electron. 40px tall, matching TITLE_BAR_HEIGHT in the main process.
 */
export function TitleBar(): React.JSX.Element {
  const mac = window.api.platform === 'darwin'
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center gap-2 text-[13px] font-semibold select-none [-webkit-app-region:drag]',
        mac ? 'pl-20' : 'pl-4'
      )}
    >
      <EmberLogo size={16} />
      Ember Mail
    </div>
  )
}
