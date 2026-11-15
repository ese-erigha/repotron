import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatCount, formatRelativeTime, formatSeconds, shortSha } from './format'

const NOW = 1_794_700_000_000
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

describe('format', () => {
  it('when a count passes one thousand, then formatCount adds a separator', () => {
    assert.equal(formatCount(6183), '6,183')
  })

  it('when a sha is given, then shortSha keeps the first 7 characters', () => {
    assert.equal(shortSha('f6fbaf0299c48eea9e656e03e2ffe7ac755e8823'), 'f6fbaf0')
  })

  it('when the time is less than a minute old, then formatRelativeTime states just now', () => {
    assert.equal(formatRelativeTime(NOW - 20_000, NOW), 'just now')
  })

  it('when the time is hours old, then formatRelativeTime uses whole hours', () => {
    assert.equal(formatRelativeTime(NOW - 2.5 * HOUR_MS, NOW), '2 hours ago')
  })

  it('when the time is days old, then formatRelativeTime uses whole days', () => {
    assert.equal(formatRelativeTime(NOW - 26 * HOUR_MS, NOW), '1 day ago')
  })

  it('when a duration is given, then formatSeconds writes seconds with one decimal', () => {
    assert.equal(formatSeconds(2_440), '2.4 s')
  })
})
