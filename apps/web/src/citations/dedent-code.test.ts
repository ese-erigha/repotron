import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { dedentCode } from './dedent-code'

describe('dedentCode', () => {
  it('when every line shares an indent, then that indent is removed', () => {
    const method = '    def route(self):\n        return decorator'

    assert.equal(dedentCode(method), 'def route(self):\n    return decorator')
  })

  it('when a blank line sits between the lines, then it does not change the shared indent', () => {
    const method = '  first()\n\n  second()'

    assert.equal(dedentCode(method), 'first()\n\nsecond()')
  })

  it('when one line starts at the left edge, then the code stays the same', () => {
    const code = 'export class Hono {\n  constructor() {}\n}'

    assert.equal(dedentCode(code), code)
  })
})
