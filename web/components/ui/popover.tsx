"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

interface PopoverContextProps {
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement>
}

const PopoverContext = React.createContext<PopoverContextProps | null>(null)

function Popover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }
>(function PopoverTrigger({ children, asChild = false, ...props }, ref) {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) throw new Error("PopoverTrigger must be within Popover")
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      ref={(node: HTMLButtonElement | null) => {
        ctx.triggerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
      }}
      onClick={() => ctx.setOpen(!ctx.open)}
      {...props}
    >
      {children}
    </Comp>
  )
})

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & { align?: "start" | "center" | "end" }
>(function PopoverContent({ className, align = "center", ...props }, ref) {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) throw new Error("PopoverContent must be within Popover")
  const [styles, setStyles] = React.useState<React.CSSProperties>({})
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        ctx.triggerRef.current &&
        !ctx.triggerRef.current.contains(e.target as Node) &&
        !(ref && (ref as React.MutableRefObject<HTMLDivElement | null>).current?.contains(e.target as Node))
      ) {
        ctx.setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    const rect = ctx.triggerRef.current?.getBoundingClientRect()
    if (rect) {
      let left = rect.left
      if (align === "center") left = rect.left + rect.width / 2
      if (align === "end") left = rect.right
      setStyles({ position: "absolute", top: rect.bottom + 4, left })
    }
    return () => document.removeEventListener("mousedown", handleClick)
  }, [ctx, align, ref])
  if (!ctx.open) return null
  return (
    <div
      ref={ref}
      style={styles}
      className={cn(
        "z-50 w-72 -translate-x-1/2 rounded-md border bg-popover p-4 text-popover-foreground shadow-md",
        className,
      )}
      {...props}
    />
  )
})

export { Popover, PopoverTrigger, PopoverContent }
