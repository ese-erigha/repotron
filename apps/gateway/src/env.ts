import { z } from 'zod'

const gatewayEnvSchema = z.object({
  APP_ORIGIN: z.string().url(),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  AI_GATEWAY_ID: z.string().min(1),
  ANSWER_MODEL_ID: z.string().min(1),
  TURNSTILE_SECRET: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  CF_AIG_TOKEN: z.string().min(1),
})

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>

export function readGatewayEnv(source: Record<string, unknown>): GatewayEnv {
  const env = {
    APP_ORIGIN: source.APP_ORIGIN,
    CLOUDFLARE_ACCOUNT_ID: source.CLOUDFLARE_ACCOUNT_ID,
    AI_GATEWAY_ID: source.AI_GATEWAY_ID,
    ANSWER_MODEL_ID: source.ANSWER_MODEL_ID,
    TURNSTILE_SECRET: source.TURNSTILE_SECRET,
    GITHUB_TOKEN: source.GITHUB_TOKEN,
    OPENROUTER_API_KEY: source.OPENROUTER_API_KEY,
    CF_AIG_TOKEN: source.CF_AIG_TOKEN,
  }
  return gatewayEnvSchema.parse(env)
}
