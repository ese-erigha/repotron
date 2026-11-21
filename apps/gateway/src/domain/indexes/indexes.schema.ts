import { z } from 'zod'

const SYMBOL_NAME_MAX_CHARS = 200

export const requestIndexSchema = z.object({
  url: z.string(),
  turnstileToken: z.string().min(1),
})

export const symbolNameSchema = z.object({
  name: z.string().trim().min(1).max(SYMBOL_NAME_MAX_CHARS),
})
