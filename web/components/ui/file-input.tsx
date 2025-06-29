"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onFile: (file: File | null) => void
  label?: React.ReactNode
}

export function FileInput({ onFile, label = "Drop or click", className, accept, ...props }: FileInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null)
    e.target.value = ""
  }
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    onFile(e.dataTransfer.files?.[0] || null)
  }
  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "relative flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed p-2 text-sm bg-[#202026] border-[#2A2A33]",
        className,
      )}
    >
      <input type="file" accept={accept} onChange={handleChange} className="hidden" {...props} />
      {label}
    </label>
  )
}

