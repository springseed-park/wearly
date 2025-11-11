export interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  image?: string;
}

export type Gender = 'male' | 'female' | 'unisex' | '';

export type Tone = 'critical' | 'witty' | 'friendly' | '';
