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
  /** Pixel size of the icon. Defaults to 44, the size in the list. */
  size?: number
}

export function Avatar({
  name,
  address,
  colorIndex,
  accountName,
  size = 44
}: AvatarProps): React.JSX.Element {
  const logo = useSenderLogo(address)
  const [broken, setBroken] = useState<string | null>(null)
  const showLogo = logo && broken !== logo.src
  const box = { width: size, height: size }
  const lift = 'shadow-[inset_0_1px_0_rgb(255_255_255/.3),0_4px_12px_-4px_rgb(0_0_0/.5)]'

  return (
    <div className="relative shrink-0">
      {showLogo ? (
        // Companies get a squircle tile, people a circle.
        <div
          style={box}
          className={cn(
            'grid animate-in place-items-center overflow-hidden rounded-[30%] bg-logo-tile ring-1 ring-logo-ring fade-in',
            lift
          )}
        >
          <img
            src={logo.src}
            alt=""
            draggable={false}
            onError={() => setBroken(logo.src)}
            className={cn(
              'size-full',
              logo.fullBleed ? 'object-cover' : 'size-[62%] object-contain'
            )}
          />
        </div>
      ) : (
        <div
          style={{ ...box, fontSize: Math.round(size * 0.34) }}
          className={cn(
            'grid place-items-center rounded-full font-semibold text-white',
            avatarColor(name),
            lift
          )}
        >
          {initials(name)}
        </div>
      )}
      {colorIndex !== undefined && (
        <span
          title={accountName}
          className={cn(
            'absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-[2.5px] border-background',
            accountDot(colorIndex)
          )}
        />
      )}
    </div>
  )
}
