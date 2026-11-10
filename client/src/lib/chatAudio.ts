import { QUICK_CHAT } from "@steal/shared";
import { sound } from "./sound";

for (const phrase of QUICK_CHAT) sound.preloadVoice(phrase.audio);

export function playChatAudio(audioPath: string | undefined): void {
  if (!audioPath) return;
  sound.playVoice(audioPath);
}
