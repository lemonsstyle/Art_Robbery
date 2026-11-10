export interface QuickChatPhrase {
  id: string;
  text: string;
  audio: string;
}

export interface ChatMessage {
  playerId: string;
  messageId: string;
  text: string;
  at: number;
}

export const QUICK_CHAT: QuickChatPhrase[] = [
  { id: "fight", text: "不要走，决战到天亮！", audio: "/audio/chat-1.mp3" },
  { id: "cooperate", text: "和你合作真是太愉快了！", audio: "/audio/chat-2.mp3" },
  { id: "mmgg", text: "你是MM还是GG啊？", audio: "/audio/chat-3.mp3" },
  { id: "offline", text: "怎么又断线了，网络怎么这么差呀？", audio: "/audio/chat-4.mp3" },
  { id: "leave", text: "各位不好意思，我要离开会儿！", audio: "/audio/chat-5.mp3" },
  { id: "praise", text: "你打的牌也太好啦！", audio: "/audio/chat-6.mp3" },
  { id: "hurry", text: "快点吧，我等到花儿都谢了。", audio: "/audio/chat-7.mp3" }
];
