import { Link, useLocation } from 'react-router-dom'

import { AppLogo } from './app-logo'
import { DASHBOARD_PATH, HOME_PATH } from './navigation.constants'
import { SHELL_TEXT } from './shell.constants'

export function AppHeader() {
  const location = useLocation()
  const isDashboard = location.pathname === DASHBOARD_PATH

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
        <div className="flex items-center gap-5">
          <Link
            to={DASHBOARD_PATH}
            aria-current={isDashboard ? 'page' : undefined}
            className={isDashboard ? 'text-[13px] font-medium text-ink' : 'text-[13px] font-medium text-mute'}
          >
            {SHELL_TEXT.SCORES}
          </Link>
          <p className="hidden text-[13px] text-mute sm:block">{SHELL_TEXT.TAGLINE}</p>
        </div>
      </div>
    </header>
  )
}
