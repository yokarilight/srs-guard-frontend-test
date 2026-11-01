import { useId, useState, type ReactNode } from 'react'

interface FileDropZoneProps {
  /** input 的 accept，例如 application/pdf,.pdf */
  accept: string
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
  /** 主要說明，例如「選擇 PDF」 */
  label: ReactNode
  hint?: ReactNode
}

/** 點擊選擇或拖曳檔案 */
export function FileDropZone({ accept, multiple = false, disabled = false, onFiles, label, hint }: FileDropZoneProps) {
  const id = useId()
  const [dragging, setDragging] = useState(false)

  function handle(list: FileList | null) {
    const files = [...(list ?? [])]
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <label
      htmlFor={id}
      className={`dropzone${dragging ? ' dropzone-active' : ''}${disabled ? ' dropzone-disabled' : ''}`}
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) handle(e.dataTransfer.files)
      }}
    >
      <input
        id={id}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          handle(e.target.files)
          // 清空才能再次選擇同一個檔案
          e.target.value = ''
        }}
      />
      <span className="dropzone-label">{label}</span>
      {hint && <span className="dropzone-hint">{hint}</span>}
    </label>
  )
}
