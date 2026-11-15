import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BUTTON_SIZE, BUTTON_VARIANT, buttonClassName } from '../ui/button.constants'
import { HOME_PATH } from './navigation.constants'

type HomeLinkProps = { label: string }

/** The way back to the home screen from a screen with nothing to show. */
export function HomeLink({ label }: HomeLinkProps) {
  return (
    <Link to={HOME_PATH} className={buttonClassName(BUTTON_VARIANT.SECONDARY, BUTTON_SIZE.MD)}>
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </Link>
  )
}
