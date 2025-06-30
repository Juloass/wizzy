"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SocketDirection, SocketEventDefinition } from "@wizzy/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { io, type Socket } from "socket.io-client";

type EventsByDirection<D extends SocketDirection> = {
  [K in keyof SocketEventDefinition as D extends SocketEventDefinition[K]["direction"]
    ? K
    : never]: (payload: SocketEventDefinition[K]["payload"]) => void;
};

type ServerToClientEvents = EventsByDirection<"server->viewer"> &
  EventsByDirection<"server->web">;
type ClientToServerEvents = EventsByDirection<"viewer->server"> &
  EventsByDirection<"web->server">;

interface Props {
  quizzes: { id: string; name: string }[];
  accessToken: string;
}

export default function StartQuizForm({ quizzes, accessToken }: Props) {
  const router = useRouter();
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  const [roomName, setRoomName] = useState("");
  const [quizId, setQuizId] = useState(quizzes[0]?.id ?? "");
  const [visibility, setVisibility] = useState<"open" | "followers" | "subs">(
    "open"
  );
  const [creating, setCreating] = useState(false);

  const startRoom = () => {
    if (!quizId || creating) return;
    setCreating(true);
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      socketUrl || undefined,
      {
        autoConnect: false,
        auth: { role: "streamer", accessToken },
      }
    );
    socket.on("connect_error", () => {
      toast.error("Failed to connect to server");
      setCreating(false);
    });
    socket.on("lobby_created", ({ lobbyId }: { lobbyId: string }) => {
      socket.disconnect();
      router.push(`/dashboard/live/${lobbyId}`);
    });
    socket.on("connect", () => {
      socket.emit("create_lobby", { quizId });
    });
    socket.connect();
  };

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
            if (v) setVisibility(v as "open" | "followers" | "subs");
          }}
        >
          <ToggleGroupItem value="open">Open</ToggleGroupItem>
          <ToggleGroupItem value="followers">Followers</ToggleGroupItem>
          <ToggleGroupItem value="subs">Subs</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="pt-4 flex justify-center">
        <Button
          className="w-full max-w-xs"
          onClick={startRoom}
          disabled={creating}
        >
          Start Quiz
        </Button>
      </div>
    </div>
  );
}
