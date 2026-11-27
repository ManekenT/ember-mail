import { app, net } from 'electron'
import { resolveTxt } from 'node:dns/promises'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { SenderLogo } from '../shared/types'

/**
 * Sender logos, like Spark: the brand logo of the sender's domain, or nothing (the
 * renderer shows initials then).
 *
 * Privacy: logos come only from the sender's own domain (its BIMI record in DNS, its
 * home page and favicon), never from a third-party icon service, so no outside company
 * learns who mails you. Each domain is asked once and cached on disk: found logos for
 * 30 days, misses for 7. Personal mail providers (Gmail, GMX, ...) are skipped, so
 * people show their initials instead of the provider's logo.
 */

const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000
const TIMEOUT_MS = 6000
const MAX_BYTES = 512 * 1024
const MAX_PARALLEL = 4

/** Mail providers whose senders are people, not brands. */
const PERSONAL_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.de',
  'hotmail.com',
  'hotmail.de',
  'live.com',
  'live.de',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'yahoo.com',
  'yahoo.de',
  'aol.com',
  'gmx.de',
  'gmx.net',
  'gmx.at',
  'gmx.ch',
  'web.de',
  't-online.de',
  'freenet.de',
  'posteo.de',
  'posteo.net',
  'mailbox.org',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'tutanota.com',
  'tuta.io',
  'arcor.de',
  'online.de',
  'mail.de',
  'fastmail.com',
  'zoho.com',
  'yandex.com',
  'mail.ru'
])

/** Second-level labels that belong to the suffix, as in example.co.uk. */
const SHARED_SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'or', 'ne'])

interface CacheEntry {
  checkedAt: number
  /** File name in the logo folder; absent for a miss. */
  file?: string
  fullBleed?: boolean
}

let index: Record<string, CacheEntry> | null = null
const pending = new Map<string, Promise<SenderLogo | null>>()
const memory = new Map<string, SenderLogo | null>()
let running = 0
const queue: (() => void)[] = []

const folder = (): string => join(app.getPath('userData'), 'sender-logos')
const indexFile = (): string => join(folder(), 'index.json')

export function getSenderLogo(address: string): Promise<SenderLogo | null> {
  const domain = brandDomain(address)
  if (!domain) return Promise.resolve(null)
  if (memory.has(domain)) return Promise.resolve(memory.get(domain) ?? null)

  let request = pending.get(domain)
  if (!request) {
    request = lookup(domain)
      .catch(() => null)
      .then((logo) => {
        memory.set(domain, logo)
        pending.delete(domain)
        return logo
      })
    pending.set(domain, request)
  }
  return request
}

/** "news@mail.shop.example.co.uk" → "example.co.uk"; null for personal providers. */
export function brandDomain(address: string): string | null {
  const host = address.split('@')[1]?.trim().toLowerCase().replace(/\.$/, '')
  if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null
  const labels = host.split('.')
  const keep =
    labels.length >= 3 &&
    SHARED_SECOND_LEVEL.has(labels[labels.length - 2]) &&
    labels.at(-1)!.length === 2
      ? 3
      : 2
  const domain = labels.slice(-keep).join('.')
  return PERSONAL_PROVIDERS.has(domain) ? null : domain
}

async function lookup(domain: string): Promise<SenderLogo | null> {
  const cached = readIndex()[domain]
  if (cached) {
    const age = Date.now() - cached.checkedAt
    if (!cached.file && age < MISS_TTL_MS) return null
    if (cached.file && age < HIT_TTL_MS) {
      const logo = readCached(cached)
      if (logo) return logo
    }
  }

  const found = await limited(() => findLogo(domain))
  const entry: CacheEntry = { checkedAt: Date.now() }
  if (found) {
    entry.file = `${domain}.${extension(found.type)}`
    entry.fullBleed = found.fullBleed
    mkdirSync(folder(), { recursive: true })
    writeFileSync(join(folder(), entry.file), found.data)
  }
  readIndex()[domain] = entry
  writeIndex()
  return found ? toLogo(found.data, found.type, found.fullBleed) : null
}

interface FoundImage {
  data: Buffer
  type: string
  fullBleed: boolean
}

/** Tries, in order: BIMI brand logo, the home page's touch icon or icon links, /favicon.ico. */
async function findLogo(domain: string): Promise<FoundImage | null> {
  const bimi = await bimiLogo(domain)
  if (bimi) return bimi

  const page = await fetchText(`https://${domain}/`)
  if (page) {
    for (const link of iconLinks(page.html, page.url)) {
      const image = await fetchImage(link.url)
      if (image) return { ...image, fullBleed: link.touch }
    }
  }

  const touch = await fetchImage(`https://${domain}/apple-touch-icon.png`)
  if (touch) return { ...touch, fullBleed: true }
  const favicon = await fetchImage(`https://${domain}/favicon.ico`)
  return favicon ? { ...favicon, fullBleed: false } : null
}

async function bimiLogo(domain: string): Promise<FoundImage | null> {
  try {
    const records = await withTimeout(resolveTxt(`default._bimi.${domain}`))
    const record = records.map((parts) => parts.join('')).find((r) => /v=BIMI1/i.test(r))
    const url = record?.match(/(?:^|;)\s*l=([^;\s]+)/i)?.[1]
    if (!url?.startsWith('https://')) return null
    const image = await fetchImage(url)
    return image && image.type === 'image/svg+xml' ? { ...image, fullBleed: true } : null
  } catch {
    return null
  }
}

interface IconLink {
  url: string
  touch: boolean
  size: number
}

/** `<link rel="apple-touch-icon">` first, then the largest `<link rel="icon">`. */
export function iconLinks(html: string, base: string): IconLink[] {
  const head = html.slice(0, 200_000)
  const links: IconLink[] = []
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, 'rel')?.toLowerCase() ?? ''
    const href = attribute(tag, 'href')
    if (!href || !/\bicon\b|apple-touch-icon/.test(rel) || /mask-icon/.test(rel)) continue
    let url: string
    try {
      url = new URL(href, base).toString()
    } catch {
      continue
    }
    if (!url.startsWith('https://') && !url.startsWith('data:image/')) continue
    const sizes = attribute(tag, 'sizes') ?? ''
    const size = sizes === 'any' ? 512 : Number(sizes.match(/(\d+)x\d+/i)?.[1] ?? 0)
    links.push({ url, touch: rel.includes('apple-touch-icon'), size })
  }
  return links.sort((a, b) => Number(b.touch) - Number(a.touch) || (b.size || 32) - (a.size || 32))
}

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined
}

async function fetchText(url: string): Promise<{ html: string; url: string } | null> {
  const response = await request(url, 'text/html')
  if (!response || !/text\/html/i.test(response.headers.get('content-type') ?? '')) return null
  const data = await readLimited(response)
  return data ? { html: data.toString('utf8'), url: response.url || url } : null
}

async function fetchImage(url: string): Promise<{ data: Buffer; type: string } | null> {
  if (url.startsWith('data:image/')) {
    const match = url.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i)
    if (!match) return null
    const data = Buffer.from(match[2], 'base64')
    const type = sniff(data)
    return type && data.length <= MAX_BYTES ? { data, type } : null
  }
  const response = await request(url, 'image/*')
  if (!response) return null
  const data = await readLimited(response)
  const type = data ? sniff(data) : null
  // Tiny images are tracking pixels or blank placeholders.
  return data && type && data.length > 100 ? { data, type } : null
}

async function request(url: string, accept: string): Promise<Response | null> {
  try {
    const response = await withTimeout(
      net.fetch(url, {
        headers: { accept, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EmberMail' },
        credentials: 'omit',
        redirect: 'follow'
      })
    )
    return response.ok ? response : null
  } catch {
    return null
  }
}

async function readLimited(response: Response): Promise<Buffer | null> {
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) return null
  const data = Buffer.from(await withTimeout(response.arrayBuffer()))
  return data.length <= MAX_BYTES ? data : null
}

/** Image type from the file's first bytes; servers often send the wrong content type. */
function sniff(data: Buffer): string | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg'
  if (data.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return 'image/x-icon'
  if (data.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif'
  if (
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  const start = data.subarray(0, 1024).toString('utf8').trimStart().toLowerCase()
  if (start.startsWith('<svg') || (start.startsWith('<?xml') && start.includes('<svg'))) {
    return 'image/svg+xml'
  }
  return null
}

function extension(type: string): string {
  return (
    {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/x-icon': 'ico',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    }[type] ?? 'img'
  )
}

function toLogo(data: Buffer, type: string, fullBleed: boolean): SenderLogo {
  return { src: `data:${type};base64,${data.toString('base64')}`, fullBleed }
}

function readCached(entry: CacheEntry): SenderLogo | null {
  try {
    const data = readFileSync(join(folder(), entry.file!))
    const type = sniff(data)
    return type ? toLogo(data, type, entry.fullBleed ?? false) : null
  } catch {
    return null
  }
}

function readIndex(): Record<string, CacheEntry> {
  if (index) return index
  try {
    index = existsSync(indexFile()) ? JSON.parse(readFileSync(indexFile(), 'utf8')) : {}
  } catch {
    index = {}
  }
  return index!
}

function writeIndex(): void {
  try {
    mkdirSync(folder(), { recursive: true })
    writeFileSync(indexFile(), JSON.stringify(index), 'utf8')
  } catch (error) {
    console.error('Could not save the logo cache', error)
  }
}

/** At most MAX_PARALLEL domains are looked up at a time, so a full inbox doesn't flood the network. */
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => queue.push(resolve))
  running++
  try {
    return await task()
  } finally {
    running--
    queue.shift()?.()
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
  ])
}
