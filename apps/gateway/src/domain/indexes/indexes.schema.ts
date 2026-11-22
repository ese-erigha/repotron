import { z } from 'zod'

export const requestIndexSchema = z.object({
  url: z.string().trim().url(),
  turnstileToken: z.string().min(1),
})
