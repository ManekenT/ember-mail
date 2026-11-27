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
import type { AccountInfo, AccountInput } from '../../../shared/types'

interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Given: edit this account. Missing: add a new one. */
  account?: AccountInfo | null
  onSaved: () => void
}

const EMPTY: AccountInput = {
  name: '',
  email: '',
  host: '',
  port: 993,
  secure: true,
  user: '',
  password: '',
  smtpHost: '',
  smtpPort: 465,
  smtpSecure: true
}

function fromAccount(account: AccountInfo): AccountInput {
  const domain = account.email.split('@')[1] ?? ''
  return {
    name: account.name,
    email: account.email,
    host: account.host,
    port: account.port,
    secure: account.secure,
    user: account.user,
    password: '',
    // Older accounts have no SMTP server yet: suggest the usual one.
    smtpHost: account.smtpHost || (domain ? `smtp.${domain}` : ''),
    smtpPort: account.smtpPort,
    smtpSecure: account.smtpSecure
  }
}

/** Adds an account, or edits one (for example to set up sending). */
export function AddAccountDialog(props: AccountDialogProps): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-[560px]">
        {/* Mounted per opening, so the form starts from the right values. */}
        {props.open && <AccountForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function AccountForm({ onOpenChange, account, onSaved }: AccountDialogProps): React.JSX.Element {
  const editing = Boolean(account)
  const [form, setForm] = useState<AccountInput>(() => (account ? fromAccount(account) : EMPTY))
  const [touched, setTouched] = useState({ host: editing, user: editing, smtpHost: editing })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<AccountInput>): void => setForm((f) => ({ ...f, ...patch }))

  const onEmailChange = (email: string): void => {
    const domain = email.split('@')[1] ?? ''
    update({
      email,
      ...(touched.user ? {} : { user: email }),
      ...(touched.host || !domain ? {} : { host: `imap.${domain}` }),
      ...(touched.smtpHost || !domain ? {} : { smtpHost: `smtp.${domain}` })
    })
  }

  const close = (): void => {
    if (!busy) onOpenChange(false)
  }

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const values = { ...form, name: form.name.trim() || form.email, smtpHost: form.smtpHost.trim() }
    try {
      if (account) {
        const { password, ...rest } = values
        await window.api.updateAccount(account.id, password ? values : rest)
      } else {
        await window.api.addAccount(values)
      }
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setError(cleanError(e as Error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{editing ? account!.name : 'Add account'}</DialogTitle>
        {!editing && (
          <DialogDescription>
            Any IMAP account works. Ember Mail tests the connection before saving, and Windows
            stores your password encrypted.
          </DialogDescription>
        )}
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
        <ServerFields
          label="IMAP server"
          id="acc-host"
          host={form.host}
          port={form.port}
          secure={form.secure}
          securePort={993}
          plainPort={143}
          plainNote="Without it, STARTTLS is used when the server offers it."
          onChange={(patch) => {
            if (patch.host !== undefined) setTouched((t) => ({ ...t, host: true }))
            update({
              ...(patch.host !== undefined ? { host: patch.host } : {}),
              ...(patch.port !== undefined ? { port: patch.port } : {}),
              ...(patch.secure !== undefined ? { secure: patch.secure } : {})
            })
          }}
        />
        <ServerFields
          label="SMTP server (sending)"
          id="acc-smtp"
          host={form.smtpHost}
          port={form.smtpPort}
          secure={form.smtpSecure}
          securePort={465}
          plainPort={587}
          plainNote="Without it, STARTTLS on port 587."
          required={false}
          onChange={(patch) => {
            if (patch.host !== undefined) setTouched((t) => ({ ...t, smtpHost: true }))
            update({
              ...(patch.host !== undefined ? { smtpHost: patch.host } : {}),
              ...(patch.port !== undefined ? { smtpPort: patch.port } : {}),
              ...(patch.secure !== undefined ? { smtpSecure: patch.secure } : {})
            })
          }}
        />
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
            required={!editing}
            placeholder={editing ? 'Unchanged' : undefined}
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
        <Button type="button" variant="outline" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Connecting…' : editing ? 'Save' : 'Add account'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function ServerFields({
  label,
  id,
  host,
  port,
  secure,
  securePort,
  plainPort,
  plainNote,
  required = true,
  onChange
}: {
  label: string
  id: string
  host: string
  port: number
  secure: boolean
  securePort: number
  plainPort: number
  plainNote: string
  required?: boolean
  onChange: (patch: { host?: string; port?: number; secure?: boolean }) => void
}): React.JSX.Element {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label={label} htmlFor={`${id}-host`}>
          <Input
            id={`${id}-host`}
            required={required}
            value={host}
            onChange={(e) => onChange({ host: e.target.value.trim() })}
          />
        </Field>
        <Field label="Port" htmlFor={`${id}-port`}>
          <Input
            id={`${id}-port`}
            type="number"
            required={required}
            min={1}
            max={65535}
            value={port}
            onChange={(e) => onChange({ port: Number(e.target.value) })}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={secure}
          onChange={(e) =>
            onChange({ secure: e.target.checked, port: e.target.checked ? securePort : plainPort })
          }
        />
        Use SSL/TLS (port {securePort}). {plainNote}
      </label>
    </div>
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
