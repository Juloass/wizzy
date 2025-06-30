"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface Props {
  quizzes: { id: string; name: string }[]
}

export default function StartQuizForm({ quizzes }: Props) {
  const [roomName, setRoomName] = useState("")
  const [quizId, setQuizId] = useState(quizzes[0]?.id ?? "")
  const [visibility, setVisibility] = useState<"open" | "followers" | "subs">(
    "open"
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Room Name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
      />
      <Select value={quizId} onValueChange={setQuizId}>
        <SelectTrigger>
          <SelectValue placeholder="Select Quiz" />
        </SelectTrigger>
        <SelectContent>
          {quizzes.map((q) => (
            <SelectItem key={q.id} value={q.id}>
              {q.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex justify-center">
        <ToggleGroup
          type="single"
          variant="outline"
          value={visibility}
          onValueChange={(v: string) => {
            if (v) setVisibility(v as "open" | "followers" | "subs")
          }}
        >
          <ToggleGroupItem value="open">Open</ToggleGroupItem>
          <ToggleGroupItem value="followers">Followers</ToggleGroupItem>
          <ToggleGroupItem value="subs">Subs</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="pt-4 flex justify-center">
        <Button className="w-full max-w-xs">Start Quiz</Button>
      </div>
    </div>
  )
}
