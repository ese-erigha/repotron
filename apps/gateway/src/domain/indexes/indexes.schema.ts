import { z } from 'zod'

export const requestIndexSchema = z.object({
  url: z.string(),
  turnstileToken: z.string().min(1),
})
