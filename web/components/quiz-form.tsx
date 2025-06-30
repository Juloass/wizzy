"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileDrop } from "@/components/ui/file-drop";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { storeAudioBlob } from "@/lib/audio";
import { storeImageBlob, getImageBlob } from "@/lib/image";
import { exportQuiz, importQuiz } from "@/lib/quizIO";
import type { QuestionPayload, QuizPayload } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Settings, Trash2, CheckCircle } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Inter } from "next/font/google";
import { useState, useEffect } from "react";

const inter = Inter({ subsets: ["latin"] });

interface QuestionForm extends QuestionPayload {
  audioEnabled?: boolean;
  imageEnabled?: boolean;
}

function ImageInputPreview({
  imageKey,
  onFile,
}: {
  imageKey: string | null;
  onFile: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (imageKey) {
      getImageBlob(imageKey).then((blob) => {
        if (blob) {
          url = URL.createObjectURL(blob);
          setPreview(url);
        } else {
          setPreview(null);
        }
      });
    } else {
      setPreview(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageKey]);

  return (
    <div className="flex items-center gap-2">
      <FileInput
        accept="image/*"
        label={imageKey ? `Image: ${imageKey}` : "Question image"}
        onFile={onFile}
        className="w-1/2 bg-[#202026] border-[#2A2A33]"
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Preview"
          className="h-24 w-1/2 max-w-[150px] rounded-md border border-[#2A2A33] object-contain"
        />
      )}
    </div>
  );
}

export default function QuizForm({
  quiz,
}: {
  quiz: QuizPayload & { id: string };
}) {
  const [name, setName] = useState(quiz.name || "");
  const [description, setDescription] = useState(quiz.description || "");
  const [questions, setQuestions] = useState<QuestionForm[]>(
    (quiz.questions || []).map((q) => ({
      ...q,
      audioEnabled: Boolean(q.audioPromptKey || q.audioRevealKey),
      imageEnabled: Boolean(q.imageKey),
    }))
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<string>(quiz.questions?.[0]?.id || "add");

  const handleAddQuestion = () => {
    const id = crypto.randomUUID();
    setQuestions([
      ...questions,
      {
        id,
        text: "",
        choices: [],
        correctChoice: 0,
        audioEnabled: false,
        imageEnabled: false,
        order: questions.length,
      },
    ]);
    setTab(id);
  };

  const addChoice = (qIdx: number) => {
    const copy = [...questions];
    if (copy[qIdx].choices.length >= 4) return;
    copy[qIdx].choices.push({
      id: crypto.randomUUID(),
      text: "",
      index: copy[qIdx].choices.length,
    });
    setQuestions(copy);
  };

  const setCorrectChoice = (qIdx: number, cIdx: number) => {
    const copy = [...questions];
    copy[qIdx].correctChoice = cIdx;
    setQuestions(copy);
  };

  const updateChoice = (qIdx: number, cIdx: number, text: string) => {
    const copy = [...questions];
    copy[qIdx].choices[cIdx].text = text;
    setQuestions(copy);
  };

  const removeChoice = (qIdx: number, cIdx: number) => {
    const copy = [...questions];
    copy[qIdx].choices.splice(cIdx, 1);
    copy[qIdx].choices.forEach((c, i) => {
      c.index = i;
    });
    if (copy[qIdx].correctChoice >= copy[qIdx].choices.length) {
      copy[qIdx].correctChoice = 0;
    }
    setQuestions(copy);
  };

  const updateQuestionText = (idx: number, text: string) => {
    const copy = [...questions];
    copy[idx].text = text;
    setQuestions(copy);
  };

  const handleAudio = async (
    idx: number,
    type: "prompt" | "reveal",
    file: File | null
  ) => {
    if (!file) return;
    const key = await storeAudioBlob(file);
    const copy = [...questions];
    if (type === "prompt") copy[idx].audioPromptKey = key;
    else copy[idx].audioRevealKey = key;
    copy[idx].audioEnabled = true;
    setQuestions(copy);
  };

  const toggleAudio = (idx: number, enabled: boolean) => {
    const copy = [...questions];
    if (!enabled) {
      copy[idx].audioPromptKey = null;
      copy[idx].audioRevealKey = null;
    }
    copy[idx].audioEnabled = enabled;
    setQuestions(copy);
  };

  const handleImage = async (idx: number, file: File | null) => {
    if (!file) return;
    const key = await storeImageBlob(file);
    const copy = [...questions];
    copy[idx].imageKey = key;
    copy[idx].imageEnabled = true;
    setQuestions(copy);
  };

  const toggleImage = (idx: number, enabled: boolean) => {
    const copy = [...questions];
    if (!enabled) {
      copy[idx].imageKey = null;
    }
    copy[idx].imageEnabled = enabled;
    setQuestions(copy);
  };

  const removeQuestion = (idx: number) => {
    const copy = [...questions];
    const removed = copy.splice(idx, 1);
    void removed;
    copy.forEach((q, i) => {
      q.order = i;
    });
    setQuestions(copy);
    if (copy.length === 0) setTab("add");
    else if (tab === questions[idx]?.id) {
      setTab(copy[Math.min(idx, copy.length - 1)].id);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const copy = Array.from(questions);
    const [moved] = copy.splice(result.source.index, 1);
    copy.splice(result.destination.index, 0, moved);
    copy.forEach((q, i) => {
      q.order = i;
    });
    setQuestions(copy);
  };

  const validate = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Quiz name required");
    if (questions.length === 0) errs.push("At least one question");
    questions.forEach((q, i) => {
      if (q.choices.length < 2 || q.choices.length > 4) {
        errs.push(`Question ${i + 1} must have 2–4 choices`);
      }
    });
    setErrors(errs);
    return errs.length === 0;
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const data = await importQuiz(file);
      setName(data.name || "");
      setDescription(data.description || "");
      setQuestions(
        (data.questions || []).map((q) => ({
          ...q,
          audioEnabled: Boolean(q.audioPromptKey || q.audioRevealKey),
          imageEnabled: Boolean(q.imageKey),
        }))
      );
      toast.success("Imported quiz");
    } catch {
      toast.error("Failed to import");
    }
  };

  const handleExport = () => {
    exportQuiz({
      name,
      description,
      questions: questions.map(({ audioEnabled, imageEnabled, ...rest }) => {
        void audioEnabled;
        void imageEnabled;
        return rest;
      }),
    });
  };

  const onSubmit = async () => {
    if (!validate()) return;
    const payload = {
      name,
      description,
      questions: questions.map(({ audioEnabled, imageEnabled, ...rest }) => {
        void audioEnabled;
        void imageEnabled;
        return rest;
      }),
    };
    const res = await fetch(quiz.id ? `/api/quiz/${quiz.id}` : "/api/quiz", {
      method: quiz.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      const msg = await res.text();
      setErrors([msg || "Failed to save"]);
      toast.error(msg || "Failed to save");
    }
  };

  return (
    <div
      className={cn("flex flex-1 overflow-hidden text-white", inter.className)}
      style={{ backgroundColor: "#0E0E12" }}
    >
      <aside
        className="w-[300px] flex flex-col p-6 space-y-6 "
        style={{ backgroundColor: "#15151A" }}
      >
        <Button
          type="button"
          onClick={handleAddQuestion}
          className="w-full bg-[#9147FF] hover:bg-[#A86EFF] cursor-pointer"
        >
          + Add Question
        </Button>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="questions">
            {(p) => (
              <div
                ref={p.innerRef}
                {...p.droppableProps}
                className="flex flex-col gap-2 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full"
              >
                {questions.map((q, idx) => (
                  <Draggable draggableId={q.id} index={idx} key={q.id}>
                    {(dp) => (
                      <div
                        ref={dp.innerRef}
                        {...dp.draggableProps}
                        {...dp.dragHandleProps}
                        className="flex items-center gap-1"
                      >
                        <div className="flex flex-col justify-center gap-1 cursor-grab p-1">
                          <span className="w-[4px] h-[4px] bg-[#888] rounded-full"></span>
                          <span className="w-[4px] h-[4px] bg-[#888] rounded-full"></span>
                          <span className="w-[4px] h-[4px] bg-[#888] rounded-full"></span>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setTab(q.id)}
                          className={cn(
                            "justify-start",
                            "px-4",
                            "cursor-pointer",
                            tab === q.id
                              ? "border border-[#9147FF] bg-[#9147FF]/20 text-white"
                              : "bg-[#202026] text-[#C0C0C0] hover:bg-[#23232A]"
                          )}
                        >
                          {q.text}
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {p.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </aside>
      <main
        className="flex-1 overflow-y-auto p-8 space-y-8 [&::-webkit-scrollbar]:w-2
    [&::-webkit-scrollbar-track]:bg-transparent
    [&::-webkit-scrollbar-thumb]:bg-white/20
    [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        <div
          className="flex items-center justify-between rounded-lg p-6 shadow"
          style={{ backgroundColor: "#15151A" }}
        >
          <h2 className="text-2xl font-semibold">{name || "Quiz Name"}</h2>
          <Dialog>
            <DialogTitle>Quizz Settings</DialogTitle>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-xl bg-muted hover:bg-muted/70"
              >
                <Settings className="size-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="p-0 bg-[#15151A] text-white border-none">
              <Card className="bg-[#15151A] text-white border-none shadow">
                <CardHeader>
                  <CardTitle>Quiz Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Quiz name"
                    style={{
                      backgroundColor: "#202026",
                      borderColor: "#2A2A33",
                    }}
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    rows={3}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "#202026",
                      borderColor: "#2A2A33",
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <FileInput
                      accept="application/json"
                      onFile={handleImport}
                      label="Import Quiz"
                      className="flex-1 bg-[#202026] border-[#2A2A33]"
                    />
                    <Button
                      type="button"
                      onClick={handleExport}
                      className="shrink-0"
                    >
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </DialogContent>
          </Dialog>
        </div>
        {questions.map((q, idx) => {
          const audioEnabled =
            q.audioEnabled ?? Boolean(q.audioPromptKey || q.audioRevealKey);
          const imageEnabled = q.imageEnabled ?? Boolean(q.imageKey);
          if (q.id !== tab) return null;
          return (
            <Card
              key={q.id}
              className="shadow"
              style={{ backgroundColor: "#15151A" }}
            >
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2">
                  <Input
                    value={q.text}
                    onChange={(e) => updateQuestionText(idx, e.target.value)}
                    placeholder="Question text"
                    style={{
                      backgroundColor: "#202026",
                      borderColor: "#2A2A33",
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    variant="ghost"
                    className="text-[#C0C0C0] hover:text-white"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <label className="flex items-center gap-3 text-[#C0C0C0]">
                  <Switch
                    checked={imageEnabled}
                    onCheckedChange={(v) => toggleImage(idx, v)}
                    className="data-[state=checked]:bg-[#9147FF]"
                  />
                  Attach Image
                </label>
                {imageEnabled && (
                  <ImageInputPreview
                    imageKey={q.imageKey}
                    onFile={(f) => handleImage(idx, f)}
                  />
                )}
                <label className="flex items-center gap-3 text-[#C0C0C0]">
                  <Switch
                    checked={audioEnabled}
                    onCheckedChange={(v) => toggleAudio(idx, v)}
                    className="data-[state=checked]:bg-[#9147FF]"
                  />
                  Enable Sounds
                </label>
                {q.choices.map((c, cIdx) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <Input
                      className="flex-1"
                      style={{
                        backgroundColor: "#202026",
                        borderColor: "#2A2A33",
                      }}
                      value={c.text}
                      onChange={(e) => updateChoice(idx, cIdx, e.target.value)}
                      placeholder={`Answer ${cIdx + 1}`}
                    />
                    <Button
                      type="button"
                      onClick={() => setCorrectChoice(idx, cIdx)}
                      variant="ghost"
                      className={cn(
                        "text-[#C0C0C0] hover:text-white",
                        q.correctChoice === cIdx &&
                          "text-green-500 hover:text-green-500"
                      )}
                    >
                      <CheckCircle className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => removeChoice(idx, cIdx)}
                      variant="ghost"
                      className="text-[#C0C0C0] hover:text-white"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => addChoice(idx)}
                  disabled={q.choices.length >= 4}
                  className="w-full bg-[#9147FF] hover:bg-[#A86EFF]"
                >
                  + Add Answer
                </Button>
                {audioEnabled && (
                  <div className="space-y-2">
                    <FileDrop
                      accept="audio/*"
                      label={
                        q.audioPromptKey
                          ? `Question audio: ${q.audioPromptKey}`
                          : "Question audio"
                      }
                      playKey={q.audioPromptKey ?? undefined}
                      onFile={(f) => handleAudio(idx, "prompt", f)}
                      className="bg-[#202026] border-[#2A2A33]"
                    />
                    <FileDrop
                      accept="audio/*"
                      label={
                        q.audioRevealKey
                          ? `Reveal audio: ${q.audioRevealKey}`
                          : "Reveal audio"
                      }
                      playKey={q.audioRevealKey ?? undefined}
                      onFile={(f) => handleAudio(idx, "reveal", f)}
                      className="bg-[#202026] border-[#2A2A33]"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {errors.length > 0 && (
          <div className="space-y-1 rounded-md border border-destructive p-4 text-destructive">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
        <Button onClick={onSubmit} className="bg-[#9147FF] hover:bg-[#A86EFF]">
          Save Quiz
        </Button>
      </main>
    </div>
  );
}
