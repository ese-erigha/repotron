import type { SourceChunkRecord } from 'db'
import {
  CONTEXT_CHUNKS,
  ERROR_CODE,
  explainFeatureQuestion,
  INDEX_STATUS,
  PRESET,
  PRESET_QUESTION,
  RETRIEVAL_MODE,
  RETRIEVAL_TOP_K,
  START_HERE_MAX_PATHS,
  type SearchScope,
} from 'repotron-domain'

import type { QuestionBody } from '../questions.schema.ts'

import { getConfig, getRepositories } from '../../../context.ts'
import { RequestError } from '../../../http-error.ts'
import { consumeLimit, RATE_LIMIT_KIND } from '../../indexes/consume-limit.ts'
import { keywordSearch, retrieveAnswerChunks, retrieveHybridChunks, semanticSearch, type SearchInput } from '../retrieve-chunks.ts'
import { openAnswerStream } from '../stream-answer.ts'

export type AskQuestionInput = {
  indexId: string
  body: QuestionBody
  remoteIp: string
  evalToken: string
  retrieval: string
}

export async function askQuestion(input: AskQuestionInput): Promise<ReadableStream<Uint8Array>> {
  if (!isEvalToken(input.evalToken)) await consumeLimit(RATE_LIMIT_KIND.question, input.remoteIp)
  const row = await getRepositories().repositoryIndexes.get(input.indexId)
  if (!row) throw new RequestError(404, ERROR_CODE.notFound, 'The index does not exist.')
  if (row.status !== INDEX_STATUS.ready) {
    throw new RequestError(409, ERROR_CODE.indexNotReady, 'The index is not ready.')
  }
  const repository = await getRepositories().githubRepositories.get(row.repositoryId)
  if (!repository) throw new RequestError(404, ERROR_CODE.notFound, 'The index does not exist.')
  const question = questionText(input.body)
  const preset = 'preset' in input.body ? input.body.preset : null
  const [chunks, paths] = await Promise.all([
    retrieveQuestionChunks(input, row.id, question),
    preset === PRESET.startHere
      ? getRepositories().sourceChunks.listPaths({ indexId: row.id, limit: START_HERE_MAX_PATHS })
      : Promise.resolve([]),
  ])
  return openAnswerStream({
    index: {
      id: row.id,
      repositoryFullName: `${repository.owner}/${repository.name}`,
      commitSha: row.commitSha,
      owner: repository.owner,
      name: repository.name,
    },
    question,
    preset,
    chunks,
    paths,
    startedAt: Date.now(),
  })
}

function isEvalToken(token: string): boolean {
  return token.length > 0 && token === getConfig().EVAL_TOKEN
}

async function retrieveQuestionChunks(
  input: AskQuestionInput,
  indexId: string,
  question: string,
): Promise<SourceChunkRecord[]> {
  const scope = questionScope(input.body)
  if (!isEvalToken(input.evalToken)) return retrieveAnswerChunks(indexId, question, scope)
  if (input.retrieval === RETRIEVAL_MODE.dense) {
    const search: SearchInput = { indexId, question, limit: CONTEXT_CHUNKS, scope }
    return semanticSearch(search)
  }
  if (input.retrieval === RETRIEVAL_MODE.bm25) {
    const search: SearchInput = { indexId, question, limit: RETRIEVAL_TOP_K, scope }
    return keywordSearch(search)
  }
  if (input.retrieval === RETRIEVAL_MODE.hybrid) return retrieveHybridChunks(indexId, question, scope)
  return retrieveAnswerChunks(indexId, question, scope)
}

function questionScope(body: QuestionBody): SearchScope | undefined {
  if (!('question' in body)) return undefined
  if (!body.language && !body.pathPrefix) return undefined
  return { language: body.language, pathPrefix: body.pathPrefix }
}

function questionText(body: QuestionBody): string {
  if ('question' in body) return body.question
  if (body.preset === PRESET.explainFeature) return explainFeatureQuestion(body.featureName)
  return PRESET_QUESTION[body.preset]
}
