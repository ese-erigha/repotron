import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { HomeScreen } from './screens/home-screen'
import { NotFoundScreen } from './screens/not-found-screen'
import { AppShell } from './shell/app-shell'
import { ANSWER_ROUTE, HOME_PATH, NOT_FOUND_ROUTE, REPOSITORY_ROUTE } from './shell/navigation.constants'

// These 2 screens hold the Markdown renderer. The home screen loads without it.
const RepositoryScreen = lazy(async () => {
  const module = await import('./screens/repository-screen')
  return { default: module.RepositoryScreen }
})

const AnswerScreen = lazy(async () => {
  const module = await import('./screens/answer-screen')
  return { default: module.AnswerScreen }
})

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path={HOME_PATH} element={<HomeScreen />} />
        <Route path={REPOSITORY_ROUTE} element={<RepositoryScreen />} />
        <Route path={ANSWER_ROUTE} element={<AnswerScreen />} />
        <Route path={NOT_FOUND_ROUTE} element={<NotFoundScreen />} />
      </Route>
    </Routes>
  )
}
