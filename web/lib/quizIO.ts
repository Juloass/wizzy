import { hasAudio, getAudioBlob } from './audio';

export async function exportQuiz(quiz: any) {
  const questions = await Promise.all(
    quiz.questions.map(async (q: any) => {
      const prompt = q.audioPromptKey && (await getAudioBlob(q.audioPromptKey));
      const reveal = q.audioRevealKey && (await getAudioBlob(q.audioRevealKey));
      return {
        ...q,
        audioPrompt: prompt ? await blobToBase64(prompt) : undefined,
        audioReveal: reveal ? await blobToBase64(reveal) : undefined,
      };
    })
  );
  return JSON.stringify({ ...quiz, questions }, null, 2);
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
