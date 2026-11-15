export const BUTTON_VARIANT = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  GHOST: 'ghost',
} as const

export type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT]

export const BUTTON_SIZE = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const

export type ButtonSize = (typeof BUTTON_SIZE)[keyof typeof BUTTON_SIZE]

const BUTTON_BASE_CLASS =
  'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed'

const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  [BUTTON_VARIANT.PRIMARY]:
    'bg-ink text-white shadow-card hover:bg-ink-soft disabled:bg-line-strong disabled:text-white disabled:shadow-none',
  [BUTTON_VARIANT.SECONDARY]:
    'border border-line bg-surface text-ink shadow-card hover:border-line-strong hover:bg-sunken disabled:opacity-50',
  [BUTTON_VARIANT.GHOST]: 'text-mute hover:bg-ink/5 hover:text-ink disabled:opacity-50',
}

const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  [BUTTON_SIZE.SM]: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  [BUTTON_SIZE.MD]: 'h-10 gap-2 rounded-xl px-4 text-sm',
  [BUTTON_SIZE.LG]: 'h-11 gap-2 rounded-xl px-5 text-[15px]',
}

/** The class names of a button. A link that looks like a button uses them too. */
export function buttonClassName(variant: ButtonVariant, size: ButtonSize): string {
  return `${BUTTON_BASE_CLASS} ${BUTTON_VARIANT_CLASS[variant]} ${BUTTON_SIZE_CLASS[size]}`
}
