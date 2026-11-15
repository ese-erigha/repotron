import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react'

type DialogProps = {
  title: string
  onClose(): void
  children: ReactNode
}

/** A modal dialog. The parent renders it while it is open. Escape and a select outside the panel close it. */
export function Dialog({ title, onClose, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={closeOnBackdrop}
      className="m-auto w-[calc(100%-2.5rem)] max-w-md animate-rise rounded-2xl border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-ink/25 backdrop:backdrop-blur-[3px]"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  )
}
