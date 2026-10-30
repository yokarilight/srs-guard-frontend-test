import { useId, type ReactNode } from 'react'

interface ControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

interface FormFieldProps {
  label: string
  error?: string
  hint?: string
  children: (props: ControlProps) => ReactNode
}

export function FormField({ label, error, hint, children }: FormFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
