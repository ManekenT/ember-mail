import { Search } from 'lucide-react'

import { EmberLogo } from '@renderer/components/EmberLogo'
import { Kbd } from '@renderer/components/Kbd'
import { cn } from '@renderer/lib/utils'

/**
 * The window's title bar, drawn by the app so it sits on the ambient glow. The whole bar
 * drags the window, except the search field; the native window buttons are overlaid on
 * the right (Windows, Linux) or left (macOS) by Electron. 40px tall, matching
 * TITLE_BAR_HEIGHT in the main process.
 */
export function TitleBar({ onSearch }: { onSearch?: () => void }): React.JSX.Element {
  const mac = window.api.platform === 'darwin'
  return (
    <div
      className={cn(
        'relative flex h-10 shrink-0 items-center gap-2 text-[13px] font-semibold select-none [-webkit-app-region:drag]',
        mac ? 'pl-20' : 'pl-4'
      )}
    >
      <EmberLogo size={16} />
      Ember Mail
      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          className="absolute top-1/2 left-1/2 flex h-7 w-[420px] max-w-[40%] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-hairline/10 bg-glass/50 px-3 text-xs font-normal text-muted-foreground backdrop-blur-xl transition-colors [-webkit-app-region:no-drag] hover:bg-glass/80 hover:text-foreground"
        >
          <Search className="size-3.5" />
          Search all accounts
          <Kbd className="ml-auto">Ctrl K</Kbd>
        </button>
      )}
    </div>
  )
}
