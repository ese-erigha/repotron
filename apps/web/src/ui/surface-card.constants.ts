export const SURFACE_ELEVATION = {
  DEFAULT: 'default',
  RAISED: 'raised',
} as const

export type SurfaceElevation = (typeof SURFACE_ELEVATION)[keyof typeof SURFACE_ELEVATION]

/** Class names for the two card elevations. `index.css` defines both. */
export const SURFACE_ELEVATION_CLASS: Record<SurfaceElevation, string> = {
  [SURFACE_ELEVATION.DEFAULT]: 'surface-card',
  [SURFACE_ELEVATION.RAISED]: 'surface-raised',
}
