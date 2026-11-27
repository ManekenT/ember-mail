import DOMPurify from 'dompurify'
import { useEffect, useMemo, useRef, useState } from 'react'

interface MailBodyProps {
  html: string | null
  text: string
}

/**
 * Shows a mail body. HTML mails are sanitized and rendered in a sandboxed
 * iframe without scripts, on a light "paper" card since most HTML mails are
 * designed for a white background. Links open in the default browser.
 */
export function MailBody({ html, text }: MailBodyProps): React.JSX.Element {
  if (!html) {
    return (
      <div className="max-w-[68ch] text-[15px] leading-7 whitespace-pre-wrap text-foreground/90">
        {text}
      </div>
    )
  }
  return <HtmlBody html={html} />
}

function HtmlBody({ html }: { html: string }): React.JSX.Element {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(200)

  const srcDoc = useMemo(() => {
    const clean = DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: true,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'base'],
      FORBID_ATTR: ['srcset']
    })
    const style = `<style>
      html, body { margin: 0; padding: 0; background: #fff; color: #18181b; overflow: hidden; }
      body { padding: 24px; font: 15px/1.6 'Segoe UI', system-ui, sans-serif; overflow-wrap: anywhere; }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      a { color: #c2410c; }
    </style>`
    return clean.includes('<head>')
      ? clean.replace('<head>', `<head>${style}`)
      : `<!doctype html><html><head>${style}</head><body>${clean}</body></html>`
  }, [html])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    let observer: ResizeObserver | null = null
    const onLoad = (): void => {
      const doc = frame.contentDocument
      if (!doc) return
      // The body grows with its content (images loading etc.); the iframe follows it.
      const measure = (): void => setHeight(Math.ceil(doc.body.getBoundingClientRect().height))
      measure()
      observer = new ResizeObserver(measure)
      observer.observe(doc.body)
      doc.addEventListener('click', (event) => {
        const link = (event.target as Element | null)?.closest?.('a')
        if (!link) return
        event.preventDefault()
        const href = link.getAttribute('href')
        if (href) void window.api.openExternal(href)
      })
    }
    frame.addEventListener('load', onLoad)
    return () => {
      frame.removeEventListener('load', onLoad)
      observer?.disconnect()
    }
  }, [srcDoc])

  return (
    <iframe
      ref={frameRef}
      title="Mail content"
      // No allow-scripts: mail content can never run code.
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      style={{ height }}
      className="w-full rounded-2xl border border-hairline/10 bg-white"
    />
  )
}
