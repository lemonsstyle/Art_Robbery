import { QUICK_CHAT } from "@steal/shared";
import { sound } from "./sound";

const cache = new Map<string, HTMLAudioElement>();

for (const phrase of QUICK_CHAT) {
  const audio = new Audio(phrase.audio);
  audio.preload = "auto";
  audio.volume = 0.95;
  cache.set(phrase.audio, audio);
}

export function playChatAudio(audioPath: string | undefined): void {
  if (!audioPath || sound.isMuted()) return;
  let audio = cache.get(audioPath);
  if (!audio) {
    audio = new Audio(audioPath);
    audio.preload = "auto";
    audio.volume = 0.95;
    cache.set(audioPath, audio);
  }
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}
