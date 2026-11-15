import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { Skeleton } from '../ui/skeleton'
import { AppHeader } from './app-header'
import { useScrollToTop } from './use-scroll-to-top'

/** The frame of every screen: the backdrop, the header, and the main area. Each screen sets its own bottom space. */
export function AppShell() {
  useScrollToTop()

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div aria-hidden className="shell-backdrop pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem]" />
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
        {/* The header stays while the code of a screen loads. */}
        <Suspense fallback={<Skeleton className="mx-auto mt-10 h-72 max-w-3xl rounded-2xl" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
