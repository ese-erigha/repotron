import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Starts each screen at its top. Without it, a new screen opens at the scroll position of the last one. */
export function useScrollToTop(): void {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
}
