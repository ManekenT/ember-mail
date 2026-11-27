import { cn } from '@renderer/lib/utils'

export function Kbd({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <kbd
      className={cn(
        'rounded border border-border bg-muted px-1.5 py-px font-mono text-[10.5px] font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  )
}
