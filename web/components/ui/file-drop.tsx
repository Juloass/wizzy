"use client"
import * as React from "react"
import { PlayIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileDropProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  onFile: (file: File | null) => void
  label?: React.ReactNode
  playKey?: string | null
}

export function FileDrop({ onFile, label = "Drop or click", playKey, className, accept, ...props }: FileDropProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null)
  }
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    onFile(e.dataTransfer.files?.[0] || null)
  }
  const handleClick = () => inputRef.current?.click()
  const play = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!playKey) return
    const { getAudioBlob } = await import("@/lib/audio")
    const blob = await getAudioBlob(playKey)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.play()
    audio.addEventListener("ended", () => URL.revokeObjectURL(url))
  }

  return (
    <label
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "relative flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed p-2 text-sm",
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
      {playKey && (
        <button
          type="button"
          onClick={play}
          className="absolute right-1 top-1 rounded-sm bg-background/70 p-1 hover:bg-background"
        >
          <PlayIcon className="size-4" />
        </button>
      )}
      {label}
    </label>
  )
}
