"use client"
import * as React from "react"
import { PlayIcon, PauseIcon } from "lucide-react"
import { cn } from "@/lib/utils"

let currentAudio: HTMLAudioElement | null = null
let currentKey: string | null = null
let currentSetter: React.Dispatch<React.SetStateAction<boolean>> | null = null

interface FileDropProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  onFile: (file: File | null) => void
  label?: React.ReactNode
  playKey?: string | null
}

export function FileDrop({ onFile, label = "Drop or click", playKey, className, accept, ...props }: FileDropProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [playing, setPlaying] = React.useState(false)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null)
    // allow re-selecting the same file later
    e.target.value = ""
  }
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    onFile(e.dataTransfer.files?.[0] || null)
  }
  const play = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (!playKey) return

    if (currentAudio && currentKey === playKey) {
      if (!currentAudio.paused) {
        currentAudio.pause()
        setPlaying(false)
        currentAudio = null
        currentKey = null
        currentSetter = null
      } else {
        currentAudio.play()
        setPlaying(true)
        currentSetter = setPlaying
      }
      return
    }

    if (currentAudio) {
      currentAudio.pause()
      currentSetter?.(false)
    }

    const { getAudioBlob } = await import("@/lib/audio")
    const blob = await getAudioBlob(playKey)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    currentAudio = audio
    currentKey = playKey
    currentSetter = setPlaying
    setPlaying(true)
    audio.play()
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(url)
      setPlaying(false)
      if (currentAudio === audio) {
        currentAudio = null
        currentKey = null
        currentSetter = null
      }
    })
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
          {playing ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
          <span className="sr-only">{playing ? "Pause" : "Play"}</span>
        </button>
      )}
      {label}
    </label>
  )
}
