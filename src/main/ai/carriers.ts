/** Tracking pages of the usual carriers, by a name as a mail writes it. */
const CARRIERS: Array<{ match: RegExp; url: (n: string) => string }> = [
  {
    match: /dhl|deutsche post/i,
    url: (n) => `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${n}`
  },
  { match: /dpd/i, url: (n) => `https://tracking.dpd.de/status/de_DE/parcel/${n}` },
  {
    match: /hermes/i,
    url: (n) => `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#${n}`
  },
  { match: /gls/i, url: (n) => `https://gls-group.com/DE/de/paketverfolgung?match=${n}` },
  { match: /ups/i, url: (n) => `https://www.ups.com/track?tracknum=${n}` },
  { match: /fedex/i, url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}` }
]

/** The carrier's own tracking page for this number, when the carrier is known. */
export function trackingLink(carrier: string, trackingNumber: string): string | null {
  if (!/^[A-Za-z0-9-]{6,40}$/.test(trackingNumber)) return null
  const found = CARRIERS.find((c) => c.match.test(carrier))
  return found ? found.url(encodeURIComponent(trackingNumber)) : null
}
