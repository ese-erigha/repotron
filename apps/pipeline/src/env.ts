import { z } from 'zod'

const pipelineEnvSchema = z.object({
  AI_GATEWAY_ID: z.string().min(1),
  R2_ENDPOINT: z.string().url(),
  R2_BUCKET: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
})

export type PipelineEnv = z.infer<typeof pipelineEnvSchema>

export function readPipelineEnv(source: Record<string, unknown>): PipelineEnv {
  const env = {
    AI_GATEWAY_ID: source.AI_GATEWAY_ID,
    R2_ENDPOINT: source.R2_ENDPOINT,
    R2_BUCKET: source.R2_BUCKET,
    GITHUB_TOKEN: source.GITHUB_TOKEN,
    R2_ACCESS_KEY_ID: source.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: source.R2_SECRET_ACCESS_KEY,
  }
  return pipelineEnvSchema.parse(env)
}
