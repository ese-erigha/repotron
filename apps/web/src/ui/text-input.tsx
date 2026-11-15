import { useId, type ComponentPropsWithoutRef } from 'react'

import { cn } from './cn'

type TextInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'type'> & {
  label: string
}

export function TextInput({ label, className, ...props }: TextInputProps) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        type="text"
        className={cn(
          'mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent focus:shadow-focus focus:outline-none',
          className,
        )}
        {...props}
      />
    </div>
  )
}
