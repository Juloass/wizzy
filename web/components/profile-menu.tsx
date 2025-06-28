'use client'

import { useState, useEffect, useRef } from 'react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface Props {
  user: { displayName: string; profileImageUrl: string }
}

export default function ProfileMenu({ user }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full transition-transform hover:scale-110 focus:outline-none"
      >
        <Avatar className="size-8">
          <AvatarImage src={user.profileImageUrl} alt={user.displayName} />
          <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-32 rounded-md border bg-popover text-popover-foreground shadow-md">
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
            >
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
