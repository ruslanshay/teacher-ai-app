export type Topic = { id: string; title: string; description?: string };

export type Prompt = {
  id: string;
  label: string;
  template: string; // use {{topic}}, {{context}}, {{curriculum}}, {{grade}}
};

export type Attachment = { id: string; name: string; kind: 'link' | 'text'; content: string };

export type LogEntry = { id: string; at: number; kind: 'generate'|'edit'|'chat'|'attach'|'privacy'|'profile'; detail: string };

export type Settings = { curriculum?: string; grade?: string };

export type HistoryItem = {
  id: string;
  at: number;
  kind: 'generate' | 'chat' | 'selection';
  promptLabel?: string;
  inputPreview: string;
  output: string;
};
