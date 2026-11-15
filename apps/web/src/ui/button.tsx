import type { ComponentPropsWithoutRef } from 'react'

import { BUTTON_SIZE, BUTTON_VARIANT, buttonClassName, type ButtonSize, type ButtonVariant } from './button.constants'
import { cn } from './cn'
import { Spinner } from './spinner'

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and turns the button off while a request runs. */
  isPending?: boolean
}

export function Button({
  variant = BUTTON_VARIANT.PRIMARY,
  size = BUTTON_SIZE.MD,
  isPending = false,
  type = 'button',
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isPending}
      className={cn(buttonClassName(variant, size), className)}
      {...props}
    >
      {isPending ? <Spinner /> : null}
      {children}
    </button>
  )
}
