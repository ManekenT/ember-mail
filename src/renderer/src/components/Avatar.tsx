import { useState } from 'react'

import { useSenderLogo } from '@renderer/hooks/useSenderLogo'
import { accountDot, avatarColor, initials } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

interface AvatarProps {
  name: string
  /** Sender address; its domain's logo replaces the initials when there is one. */
  address?: string
  /** Shows the account's colour as a small dot when given. */
  colorIndex?: number
  accountName?: string
}

export function Avatar({ name, address, colorIndex, accountName }: AvatarProps): React.JSX.Element {
  const logo = useSenderLogo(address)
  const [broken, setBroken] = useState<string | null>(null)
  const showLogo = logo && broken !== logo.src

  return (
    <div className="relative shrink-0">
      {showLogo ? (
        <div className="grid size-11 animate-in place-items-center overflow-hidden rounded-full bg-logo-tile ring-1 ring-logo-ring fade-in">
          <img
            src={logo.src}
            alt=""
            draggable={false}
            onError={() => setBroken(logo.src)}
            className={cn('size-full', logo.fullBleed ? 'object-cover' : 'size-7 object-contain')}
          />
        </div>
      ) : (
        <div
          className={cn(
            'grid size-11 place-items-center rounded-full text-sm font-semibold text-white',
            avatarColor(name)
          )}
        >
          {initials(name)}
        </div>
      )}
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
