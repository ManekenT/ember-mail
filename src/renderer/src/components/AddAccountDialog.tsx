import { useState } from 'react'

import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { cleanError } from '@renderer/lib/errors'
import type { AccountInput } from '../../../shared/types'

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}

const EMPTY: AccountInput = {
  name: '',
  email: '',
  host: '',
  port: 993,
  secure: true,
  user: '',
  password: ''
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onAdded
}: AddAccountDialogProps): React.JSX.Element {
  const [form, setForm] = useState<AccountInput>(EMPTY)
  const [touched, setTouched] = useState({ host: false, user: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<AccountInput>): void => setForm((f) => ({ ...f, ...patch }))

  const onEmailChange = (email: string): void => {
    const domain = email.split('@')[1] ?? ''
    update({
      email,
      ...(touched.user ? {} : { user: email }),
      ...(touched.host || !domain ? {} : { host: `imap.${domain}` })
    })
  }

  const reset = (): void => {
    setForm(EMPTY)
    setTouched({ host: false, user: false })
    setError(null)
  }

  const close = (next: boolean): void => {
    if (busy) return
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await window.api.addAccount({ ...form, name: form.name.trim() || form.email })
      onAdded()
      reset()
      onOpenChange(false)
    } catch (e) {
      setError(cleanError(e as Error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>
              Any IMAP account works. Ember Mail tests the connection before saving, and Windows
              stores your password encrypted.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Name" htmlFor="acc-name">
              <Input
                id="acc-name"
                placeholder="Personal"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
            <Field label="Email address" htmlFor="acc-email">
              <Input
                id="acc-email"
                type="email"
                required
                placeholder="you@yourdomain.de"
                value={form.email}
                onChange={(e) => onEmailChange(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Field label="IMAP server" htmlFor="acc-host">
                <Input
                  id="acc-host"
                  required
                  placeholder="imap.yourdomain.de"
                  value={form.host}
                  onChange={(e) => {
                    setTouched((t) => ({ ...t, host: true }))
                    update({ host: e.target.value.trim() })
                  }}
                />
              </Field>
              <Field label="Port" htmlFor="acc-port">
                <Input
                  id="acc-port"
                  type="number"
                  required
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => update({ port: Number(e.target.value) })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.secure}
                onChange={(e) =>
                  update({ secure: e.target.checked, port: e.target.checked ? 993 : 143 })
                }
              />
              Use SSL/TLS (port 993). Without it, STARTTLS is used when the server offers it.
            </label>
            <Field label="Username" htmlFor="acc-user">
              <Input
                id="acc-user"
                required
                value={form.user}
                onChange={(e) => {
                  setTouched((t) => ({ ...t, user: true }))
                  update({ user: e.target.value })
                }}
              />
            </Field>
            <Field label="Password" htmlFor="acc-password">
              <Input
                id="acc-password"
                type="password"
                required
                value={form.password}
                onChange={(e) => update({ password: e.target.value })}
              />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Connecting…' : 'Add account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  children
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
