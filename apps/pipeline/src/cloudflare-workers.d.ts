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

  export class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    env: Env
    constructor(ctx: ExecutionContext, env: Env)
  }

  export type WorkflowEvent<Params> = { payload: Params; instanceId: string }

  export type WorkflowStepConfig = {
    retries?: { limit: number; delay: string; backoff: 'constant' | 'linear' | 'exponential' }
  }

  export type WorkflowStep = {
    do<T>(name: string, config: WorkflowStepConfig, work: () => Promise<T>): Promise<T>
  }
}
