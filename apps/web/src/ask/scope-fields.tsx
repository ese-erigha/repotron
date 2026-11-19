import { LANGUAGE, PATH_PREFIX_MAX_CHARS, type Language } from 'repotron-domain'

import { ASK_TEXT } from './ask.constants'

const LANGUAGES = Object.values(LANGUAGE)

type ScopeFieldsProps = {
  language: string
  pathPrefix: string
  onLanguage(language: string): void
  onPathPrefix(pathPrefix: string): void
}

/** Optional language and path prefix for one question. */
export function ScopeFields({ language, pathPrefix, onLanguage, onPathPrefix }: ScopeFieldsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-1">
      <label className="text-[13px] text-mute">
        <span className="sr-only">{ASK_TEXT.SCOPE_LANGUAGE}</span>
        <select
          value={language}
          onChange={(event) => onLanguage(event.target.value)}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink"
        >
          <option value="">{ASK_TEXT.SCOPE_ANY_LANGUAGE}</option>
          {LANGUAGES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-40 flex-1 text-[13px] text-mute">
        <span className="sr-only">{ASK_TEXT.SCOPE_PATH}</span>
        <input
          value={pathPrefix}
          maxLength={PATH_PREFIX_MAX_CHARS}
          placeholder={ASK_TEXT.SCOPE_PATH_PLACEHOLDER}
          onChange={(event) => onPathPrefix(event.target.value)}
          className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink placeholder:text-faint"
        />
      </label>
    </div>
  )
}

export function scopeFromFields(language: string, pathPrefix: string): { language?: Language; pathPrefix?: string } {
  const trimmedPath = pathPrefix.trim()
  const known = LANGUAGES.find((item) => item === language)
  return {
    ...(known ? { language: known } : {}),
    ...(trimmedPath === '' ? {} : { pathPrefix: trimmedPath }),
  }
}
