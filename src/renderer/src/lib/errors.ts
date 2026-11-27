/** Electron prefixes IPC errors with "Error invoking remote method ...". */
export function cleanError(error: Error): string {
  return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
