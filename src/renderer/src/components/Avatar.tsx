import { accountDot, avatarColor, initials } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

interface AvatarProps {
  name: string
  /** Shows the account's colour as a small dot when given. */
  colorIndex?: number
  accountName?: string
}

export function Avatar({ name, colorIndex, accountName }: AvatarProps): React.JSX.Element {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          'grid size-11 place-items-center rounded-full text-sm font-semibold text-white',
          avatarColor(name)
        )}
      >
        {initials(name)}
      </div>
      {colorIndex !== undefined && (
        <span
          title={accountName}
          className={cn(
            'absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-background',
            accountDot(colorIndex)
          )}
        />
      )}
    </div>
  )
}
