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

/** Must match the number of --account-N colours in the renderer's main.css. */
export const ACCOUNT_COLORS = 8

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

/** The lowest colour slot no other account uses. */
function freeColor(used: Set<number>): number {
  for (let i = 0; i < ACCOUNT_COLORS; i++) if (!used.has(i)) return i
  return used.size % ACCOUNT_COLORS
}

/**
 * Gives every account its own colour. Older versions had only 3 colours and reused
 * them, so a 4th account looked like the 1st; this fixes such duplicates once.
 */
function withDistinctColors(accounts: StoredAccount[]): StoredAccount[] {
  const used = new Set<number>()
  let changed = false
  const result = accounts.map((account) => {
    let colorIndex = account.colorIndex
    if (used.has(colorIndex) || colorIndex < 0 || colorIndex >= ACCOUNT_COLORS) {
      colorIndex = freeColor(used)
      changed = true
    }
    used.add(colorIndex)
    return colorIndex === account.colorIndex ? account : { ...account, colorIndex }
  })
  if (changed) writeStored(result)
  return result
}

export function listAccounts(): AccountInfo[] {
  return withDistinctColors(readStored()).map(toInfo)
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
  const stored = withDistinctColors(readStored())
  const { password, ...rest } = input
  const account: StoredAccount = {
    ...rest,
    id: randomUUID(),
    colorIndex: freeColor(new Set(stored.map((a) => a.colorIndex))),
    encryptedPassword: safeStorage.encryptString(password).toString('base64')
  }
  writeStored([...stored, account])
  return toInfo(account)
}

export function deleteAccount(id: string): void {
  writeStored(readStored().filter((a) => a.id !== id))
}
