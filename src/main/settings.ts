import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Secrets the app keeps, each encrypted with safeStorage (Windows DPAPI) like the passwords. */
export type SecretName = 'claudeKey' | 'todoistToken'

type StoredSettings = Partial<Record<SecretName, string>>

const settingsFile = (): string => join(app.getPath('userData'), 'settings.json')

function readStored(): StoredSettings {
  const file = settingsFile()
  if (!existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as StoredSettings
  } catch {
    return {}
  }
}

export function getSecret(name: SecretName): string | null {
  const encrypted = readStored()[name]
  if (!encrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return null
  }
}

export function setSecret(name: SecretName, value: string | null): void {
  const stored = readStored()
  if (value) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system.')
    }
    stored[name] = safeStorage.encryptString(value).toString('base64')
  } else {
    delete stored[name]
  }
  writeFileSync(settingsFile(), JSON.stringify(stored, null, 2), 'utf8')
}
