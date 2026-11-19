import { z } from 'zod'
import { FEATURE_NAME_MAX_CHARS, languageSchema, PATH_PREFIX_MAX_CHARS, PRESET, QUESTION_MAX_CHARS } from 'repotron-domain'

const scopeFields = {
  language: languageSchema.optional(),
  pathPrefix: z.string().trim().min(1).max(PATH_PREFIX_MAX_CHARS).optional(),
}

export const questionBodySchema = z.union([
  z.object({ question: z.string().trim().min(1).max(QUESTION_MAX_CHARS), ...scopeFields }),
  z.object({ preset: z.literal(PRESET.startHere) }),
  z.object({
    preset: z.literal(PRESET.explainFeature),
    featureName: z.string().trim().min(1).max(FEATURE_NAME_MAX_CHARS),
  }),
])

export type QuestionBody = z.infer<typeof questionBodySchema>
