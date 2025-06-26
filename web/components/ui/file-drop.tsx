"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface FileDropProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  onFile: (file: File | null) => void
  label?: React.ReactNode
}

export function FileDrop({ onFile, label = "Drop or click", className, accept, ...props }: FileDropProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null)
  }
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    onFile(e.dataTransfer.files?.[0] || null)
  }
  const handleClick = () => inputRef.current?.click()

  return (
    <label
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed p-2 text-sm",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        {...props}
      />
      {label}
    </label>
  )
}
