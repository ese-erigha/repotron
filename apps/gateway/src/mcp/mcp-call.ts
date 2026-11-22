import { AsyncLocalStorage } from 'node:async_hooks'

const callStorage = new AsyncLocalStorage<{ remoteIp: string }>()

export function runMcpCall<T>(remoteIp: string, run: () => T): T {
  return callStorage.run({ remoteIp }, run)
}

export function mcpRemoteIp(): string {
  return callStorage.getStore()?.remoteIp ?? ''
}
