declare module 'cloudflare:workers' {
  export class DurableObject<Env = unknown> {
    ctx: DurableObjectState
    env: Env
    constructor(ctx: DurableObjectState, env: Env)
  }

  export interface DurableObjectState {
    storage: {
      get<T>(key: string): Promise<T | undefined>
      put<T>(key: string, value: T): Promise<void>
    }
  }
}
