export interface Note {
  id: number;
  user_id: string;
  title: string | null;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string | null;
  embedding: number[] | null;
  starred: boolean;
  archived_at: string | null;
  position: string | null;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface MatchedNote {
  id: number;
  content: string;
  similarity: number;
}

export interface ChatRequestMessage {
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}
