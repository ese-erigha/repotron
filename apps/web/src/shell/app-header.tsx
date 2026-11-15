import { Link } from 'react-router-dom'

import { AppLogo } from './app-logo'
import { HOME_PATH } from './navigation.constants'
import { SHELL_TEXT } from './shell.constants'

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          to={HOME_PATH}
          aria-label={SHELL_TEXT.HOME_LABEL}
          className="-ml-1 flex items-center gap-2.5 rounded-lg px-1 py-1"
        >
          <AppLogo className="size-7" />
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{SHELL_TEXT.NAME}</span>
        </Link>
        <p className="hidden text-[13px] text-mute sm:block">{SHELL_TEXT.TAGLINE}</p>
      </div>
    </header>
  )
}
