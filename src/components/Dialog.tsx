import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="dialog-title">
      {open && (
        <>
          <h2 id="dialog-title">{title}</h2>
          {children}
        </>
      )}
    </dialog>
  )
}
