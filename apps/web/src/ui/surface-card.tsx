import type { ComponentPropsWithoutRef, ElementType } from 'react'

import { cn } from './cn'
import { SURFACE_ELEVATION, SURFACE_ELEVATION_CLASS, type SurfaceElevation } from './surface-card.constants'

type SurfaceCardProps<T extends ElementType> = {
  as?: T
  elevation?: SurfaceElevation
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function SurfaceCard<T extends ElementType = 'div'>({
  as,
  elevation = SURFACE_ELEVATION.DEFAULT,
  className,
  children,
  ...props
}: SurfaceCardProps<T>) {
  const Component: ElementType = as ?? 'div'

  return (
    <Component className={cn(SURFACE_ELEVATION_CLASS[elevation], className)} {...props}>
      {children}
    </Component>
  )
}
