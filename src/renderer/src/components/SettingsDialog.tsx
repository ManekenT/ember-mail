import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { cleanError } from '@renderer/lib/errors'
import type { AiSettings } from '../../../shared/types'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a key or token was saved or removed. */
  onChanged: (settings: AiSettings) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  onChanged
}: SettingsDialogProps): React.JSX.Element {
  const [settings, setSettings] = useState<AiSettings | null>(null)

  useEffect(() => {
    if (open) void window.api.getAiSettings().then(setSettings)
  }, [open])

  const apply = (next: AiSettings): void => {
    setSettings(next)
    onChanged(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Keys and tokens are stored encrypted by Windows.</DialogDescription>
        </DialogHeader>
        {settings && (
          <div className="grid gap-6">
            <SenderName />
            <SecretField
              id="claude-key"
              label="Claude API key"
              placeholder="sk-ant-…"
              saved={settings.hasClaudeKey}
              error={settings.claudeError}
              linkText="Create a key in the Claude Console"
              linkUrl="https://console.anthropic.com/settings/keys"
              save={(value) => window.api.setClaudeKey(value)}
              onSaved={apply}
            />
            <SecretField
              id="todoist-token"
              label="Todoist API token"
              saved={settings.hasTodoistToken}
              error={null}
              linkText="Find it in Todoist under Settings › Integrations › Developer"
              linkUrl="https://app.todoist.com/app/settings/integrations/developer"
              save={(value) => window.api.setTodoistToken(value)}
              onSaved={apply}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SecretField({
  id,
  label,
  placeholder,
  saved,
  error,
  linkText,
  linkUrl,
  save,
  onSaved
}: {
  id: string
  label: string
  placeholder?: string
  saved: boolean
  /** A problem with the saved value, shown under it. */
  error: string | null
  linkText: string
  linkUrl: string
  save: (value: string | null) => Promise<AiSettings>
  onSaved: (settings: AiSettings) => void
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const run = async (next: string | null): Promise<void> => {
    setBusy(true)
    setFailure(null)
    try {
      onSaved(await save(next))
      setValue('')
    } catch (e) {
      setFailure(cleanError(e as Error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {saved ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check className="size-4 text-live" /> Saved
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={() => void run(null)}
          >
            Remove
          </Button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim()) void run(value)
          }}
        >
          <Input
            id={id}
            type="password"
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" disabled={busy || !value.trim()}>
            {busy && <LoaderCircle className="animate-spin" />}
            Save
          </Button>
        </form>
      )}
      {(failure ?? error) && (
        <p role="alert" className="text-sm text-destructive">
          {failure ?? error}
        </p>
      )}
      {!saved && (
        <button
          type="button"
          className="w-fit text-left text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => void window.api.openExternal(linkUrl)}
        >
          {linkText}
        </button>
      )}
    </div>
  )
}

/** The name on outgoing mail, saved when the field loses focus. */
function SenderName(): React.JSX.Element {
  const [name, setName] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.api.getSenderName().then(setName)
  }, [])

  return (
    <div className="grid gap-2">
      <Label htmlFor="sender-name">Your name on sent mail</Label>
      <div className="flex items-center gap-3">
        <Input
          id="sender-name"
          value={name ?? ''}
          disabled={name === null}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          onBlur={() => {
            if (name === null) return
            void window.api.setSenderName(name).then(() => setSaved(true))
          }}
        />
        {saved && <Check className="size-4 shrink-0 text-live" />}
      </div>
    </div>
  )
}
