export enum AppView {
  VOICE_CONVERSATION = "voice",
  KNOWLEDGE_CHAT = "knowledge",
  TRANSCRIPTION = "transcription",
  SETTINGS = "settings",
}

export interface AppSettings {
  persona?: string;
  voiceName?: string;
  voiceBotName?: string;
  voiceUserName?: string;
  voiceContext?: string;
  contextWindow?: number;
}
