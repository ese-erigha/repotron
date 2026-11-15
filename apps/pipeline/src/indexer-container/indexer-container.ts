import { Container } from '@cloudflare/containers'

const CONTAINER_ENV = [
  'GITHUB_TOKEN',
  'R2_ENDPOINT',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const

export class Indexer extends Container<Record<string, unknown>> {
  defaultPort = 8080
  sleepAfter = '1m'

  constructor(ctx: ConstructorParameters<typeof Container>[0], env: Record<string, unknown>) {
    super(ctx, env)
    this.envVars = containerEnv(env)
  }
}

function containerEnv(env: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {}
  for (const name of CONTAINER_ENV) {
    const value = env[name]
    if (typeof value !== 'string' || value === '') throw new Error(`${name} is required.`)
    values[name] = value
  }
  return values
}
