import { z } from 'zod'
import { FEATURE_NAME_MAX_CHARS, PRESET, QUESTION_MAX_CHARS } from 'repotron-domain'

export const questionBodySchema = z.union([
  z.object({ question: z.string().trim().min(1).max(QUESTION_MAX_CHARS) }),
  z.object({ preset: z.literal(PRESET.startHere) }),
  z.object({
    preset: z.literal(PRESET.explainFeature),
    featureName: z.string().trim().min(1).max(FEATURE_NAME_MAX_CHARS),
  }),
])

export type QuestionBody = z.infer<typeof questionBodySchema>
