export type VectorMatch = { id: string }

export type VectorIndex = {
  upsert(
    vectors: {
      id: string
      values: number[]
      namespace: string
      metadata: Record<string, string>
    }[],
  ): Promise<unknown>
  deleteByIds(ids: string[]): Promise<unknown>
  describe(): Promise<{ processedUpToDatetime?: string | number | null }>
  query(
    vector: number[],
    options: { topK: number; namespace: string; returnValues: false; returnMetadata: 'none' },
  ): Promise<{ matches?: VectorMatch[] }>
}

export type BatchObject = { text(): Promise<string> }

export type BatchBucket = {
  get(key: string): Promise<BatchObject | null>
  delete(keys: string[]): Promise<void>
}

export type AiBinding = {
  run(
    model: string,
    input: { text: string[] },
    options: { gateway: { id: string } },
  ): Promise<{ data?: number[][] }>
}

export type WorkflowStart = { id: string; params: { indexId: string } }

export type WorkflowClient = {
  create(instance: WorkflowStart): Promise<unknown>
  createBatch(instances: WorkflowStart[]): Promise<unknown>
  get(id: string): { restart(): Promise<void> }
}

export type IndexerNamespace = unknown
