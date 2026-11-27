export function EmberLogo({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2c1 3.2 4.8 5.3 4.8 10.2A4.8 4.8 0 0 1 12 17a4.8 4.8 0 0 1-4.8-4.8c0-2 .9-3.3 1.9-4.4.2 1.5 1 2.6 2.2 2.9C10.8 7.8 11.5 4.6 12 2Z"
        fill="var(--primary)"
      />
    </svg>
  )
}
