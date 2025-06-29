import { getAudioBlob, storeAudioBlob } from './audio'
import { getImageBlob, storeImageBlob } from './image'
import type { QuizPayload, QuestionPayload } from './types'

export async function exportQuiz(quiz: QuizPayload & { id: string }) {
  const questions = await Promise.all(
    quiz.questions.map(async (q: QuestionPayload) => {
      const prompt = q.audioPromptKey && (await getAudioBlob(q.audioPromptKey));
      const reveal = q.audioRevealKey && (await getAudioBlob(q.audioRevealKey));
      const img = q.imageKey && (await getImageBlob(q.imageKey));
      return {
        ...q,
        audioPrompt: prompt ? await blobToBase64(prompt) : undefined,
        audioReveal: reveal ? await blobToBase64(reveal) : undefined,
        image: img ? await blobToBase64(img) : undefined,
      };
    })
  );
  return JSON.stringify({ ...quiz, questions }, null, 2);
}

export async function importQuiz(json: string): Promise<QuizPayload & { id?: string }> {
  const data = JSON.parse(json) as QuizPayload & { id?: string };
  const questions = await Promise.all(
    data.questions.map(async (q) => {
      const {
        audioPrompt,
        audioReveal,
        audioPromptKey,
        audioRevealKey,
        image,
        imageKey,
        ...rest
      } = q;
      let promptKey = audioPromptKey ?? null;
      if (audioPrompt && !promptKey) {
        const blob = dataUrlToBlob(audioPrompt);
        promptKey = await storeAudioBlob(blob);
      }
      let revealKey = audioRevealKey ?? null;
      if (audioReveal && !revealKey) {
        const blob = dataUrlToBlob(audioReveal);
        revealKey = await storeAudioBlob(blob);
      }
      let imgKey = imageKey ?? null;
      if (image && !imgKey) {
        const blob = dataUrlToBlob(image);
        imgKey = await storeImageBlob(blob);
      }
      return { ...rest, audioPromptKey: promptKey, audioRevealKey: revealKey, imageKey: imgKey };
    }),
  );
  return { ...data, questions };
}

function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
