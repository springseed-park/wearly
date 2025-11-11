export interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  image?: string; // User-uploaded image
  generatedImage?: string; // AI-generated image
  loadingImage?: boolean;
}

export type Gender = 'male' | 'female' | 'unisex' | '';

export type Tone = 'critical' | 'witty' | 'friendly' | '';