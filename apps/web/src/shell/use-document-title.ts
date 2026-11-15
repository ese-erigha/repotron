import { useEffect } from 'react'

import { SHELL_TEXT } from './shell.constants'

/** Sets the title of the browser tab for one screen. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title === '' ? SHELL_TEXT.NAME : `${title} · ${SHELL_TEXT.NAME}`
  }, [title])
}
