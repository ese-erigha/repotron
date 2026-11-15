import { createHash } from 'node:crypto'

import { CHUNK_KIND, type ChunkKind } from 'repotron-domain'

import type { FixtureChunk, FixtureRepository } from './fixture-repository.ts'

export type GenericRepositoryInput = { owner: string; name: string }

type ChunkLines = {
  path: string
  startLine: number
  symbol: string | null
  kind: ChunkKind
  lines: readonly string[]
}

/** Builds a repository for a link that has no handwritten fixture. Each chunk is Markdown, so it fits every language. */
export function buildGenericRepository(input: GenericRepositoryInput): FixtureRepository {
  const fullName = `${input.owner}/${input.name}`
  return {
    id: String(Number.parseInt(hashOf(`id:${fullName}`).slice(0, 8), 16)),
    owner: input.owner,
    name: input.name,
    commitSha: hashOf(`head:${fullName}`),
    fileCount: 100 + (Number.parseInt(hashOf(`files:${fullName}`).slice(0, 3), 16) % 900),
    chunkCount: 900 + (Number.parseInt(hashOf(`chunks:${fullName}`).slice(0, 4), 16) % 6000),
    chunks: genericChunks(input),
    overview: { sources: GENERIC_SOURCES, text: overviewAnswer(input.name) },
    startHere: { sources: GENERIC_SOURCES, text: startHereAnswer(input.name) },
    topics: [],
    features: [{ keywords: ['install', 'setup'], sources: GENERIC_SOURCES, text: installFeatureAnswer(input.name) }],
  }
}

/** A stable 40-character value, in the shape of a commit sha. */
export function hashOf(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}

const GENERIC_SOURCES = ['readme-title', 'readme-usage', 'readme-install', 'contributing', 'license'] as const

function genericChunks(input: GenericRepositoryInput): Record<string, FixtureChunk> {
  return {
    'readme-title': toChunk({
      path: 'README.md',
      startLine: 1,
      symbol: input.name,
      kind: CHUNK_KIND.heading,
      lines: [
        `# ${input.name}`,
        '',
        `${input.name} is an open source project that ${input.owner} maintains.`,
        'This README describes the purpose of the project, the setup,',
        'and the first steps.',
        '',
        '- A small public API',
        '- Tests for each module',
        '- Releases that follow semantic versioning',
      ],
    }),
    'readme-install': toChunk({
      path: 'README.md',
      startLine: 11,
      symbol: 'Installation',
      kind: CHUNK_KIND.heading,
      lines: [
        '## Installation',
        '',
        'Clone the repository, then run the setup script:',
        '',
        '```bash',
        `git clone https://github.com/${input.owner}/${input.name}.git`,
        `cd ${input.name}`,
        './scripts/setup.sh',
        '```',
        '',
        'The setup script installs each dependency and runs the tests one time.',
      ],
    }),
    'readme-usage': toChunk({
      path: 'README.md',
      startLine: 23,
      symbol: 'Usage',
      kind: CHUNK_KIND.heading,
      lines: [
        '## Usage',
        '',
        'Start with the example in `examples/basic`. It shows the smallest',
        `program that uses ${input.name}.`,
        '',
        '```bash',
        './scripts/run-example.sh basic',
        '```',
        '',
        'The `docs/` folder holds the full guide and the API reference.',
      ],
    }),
    contributing: toChunk({
      path: 'CONTRIBUTING.md',
      startLine: 1,
      symbol: 'Contributing',
      kind: CHUNK_KIND.heading,
      lines: [
        '# Contributing',
        '',
        'Open an issue before you start a large change.',
        '',
        '1. Fork the repository and create a branch.',
        '2. Add a test for each change in behavior.',
        '3. Run `./scripts/test.sh` before you open the pull request.',
        '',
        'A maintainer reviews each pull request within one week.',
      ],
    }),
    license: toChunk({
      path: 'LICENSE',
      startLine: 1,
      symbol: null,
      kind: CHUNK_KIND.window,
      lines: [
        'MIT License',
        '',
        `Copyright (c) ${input.owner}`,
        '',
        'Permission is hereby granted, free of charge, to any person obtaining a copy',
        'of this software and associated documentation files (the "Software"), to deal',
        'in the Software without restriction, including without limitation the rights',
        'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
        'copies of the Software, and to permit persons to whom the Software is',
        'furnished to do so, subject to the following conditions:',
      ],
    }),
  }
}

function toChunk(chunk: ChunkLines): FixtureChunk {
  return {
    path: chunk.path,
    startLine: chunk.startLine,
    endLine: chunk.startLine + chunk.lines.length - 1,
    symbol: chunk.symbol,
    kind: chunk.kind,
    content: chunk.lines.join('\n'),
  }
}

function overviewAnswer(name: string): string {
  return `The README describes \`${name}\` as an open source project with a small public API [1]. The usage section points to the example in \`examples/basic\` and to the \`docs/\` folder [2].

To set up the project, clone the repository and run \`./scripts/setup.sh\` [3]. The contributing guide asks for a test with each change in behavior [4]. The project uses the MIT License [5].`
}

function startHereAnswer(name: string): string {
  return `## Purpose

\`${name}\` is an open source project with a small public API and tests for each module [1].

## Entry points

- \`examples/basic\` holds the smallest program that uses the project [2].
- \`./scripts/setup.sh\` installs each dependency and runs the tests [3].

## Main modules

- **\`README.md\`** — the purpose, the setup, and the first steps [1].
- **\`docs/\`** — the full guide and the API reference [2].
- **\`CONTRIBUTING.md\`** — the steps for a pull request [4].

## Reading order

1. \`README.md\` [1]
2. The example in \`examples/basic\` [2]
3. \`CONTRIBUTING.md\`, before the first change [4]`
}

function installFeatureAnswer(name: string): string {
  return `## What it does

The setup script prepares a clone of \`${name}\` for development [3].

## The flow

1. Clone the repository with \`git clone\` [3].
2. Run \`./scripts/setup.sh\` in the project folder [3].
3. The script installs each dependency, then runs the tests one time [3].

## The key files

- \`README.md\` — the installation section [3]
- \`CONTRIBUTING.md\` — the test command for a change [4]

## The edge cases

- The README states no supported platform and no minimum version [3].
- A large change needs an issue before the work starts [4].`
}
