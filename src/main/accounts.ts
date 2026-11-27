import { app, safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { AccountInfo, AccountInput } from '../shared/types'

interface StoredAccount extends AccountInfo {
  /** Password encrypted with Electron safeStorage (Windows DPAPI), base64. */
  encryptedPassword: string
}

// Linux test machines often have no keyring. Only for automated tests there; never on Windows.
if (process.platform === 'linux' && process.env.EMBER_TEST_PLAINTEXT_PASSWORDS === '1') {
  safeStorage.setUsePlainTextEncryption(true)
}

const accountsFile = (): string => join(app.getPath('userData'), 'accounts.json')

function readStored(): StoredAccount[] {
  const file = accountsFile()
  if (!existsSync(file)) return []
  return JSON.parse(readFileSync(file, 'utf8')) as StoredAccount[]
}

function writeStored(accounts: StoredAccount[]): void {
  writeFileSync(accountsFile(), JSON.stringify(accounts, null, 2), 'utf8')
}

function toInfo(stored: StoredAccount): AccountInfo {
  const { id, name, email, host, port, secure, user, colorIndex } = stored
  return { id, name, email, host, port, secure, user, colorIndex }
}

export function listAccounts(): AccountInfo[] {
  return readStored().map(toInfo)
}

export function getPassword(id: string): string {
  const account = readStored().find((a) => a.id === id)
  if (!account) throw new Error(`Unknown account ${id}`)
  return safeStorage.decryptString(Buffer.from(account.encryptedPassword, 'base64'))
}

export function saveAccount(input: AccountInput): AccountInfo {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure password storage is not available on this system.')
  }
  const stored = readStored()
  const { password, ...rest } = input
  const account: StoredAccount = {
    ...rest,
    id: randomUUID(),
    colorIndex: stored.length % 3,
    encryptedPassword: safeStorage.encryptString(password).toString('base64')
  }
  writeStored([...stored, account])
  return toInfo(account)
}

export function deleteAccount(id: string): void {
  writeStored(readStored().filter((a) => a.id !== id))
}
