import { AudioRecorder, AudioTranscript } from '../audio/AudioRecorder';
import { AudioPlayer } from '../audio/AudioPlayer';
import { ChatService, ChatMessage, UserContext } from '../chat/chatService';

export interface AudioChatMessage extends ChatMessage {
  audioUri?: string;
  transcript?: AudioTranscript;
  isAudioMessage?: boolean;
}

export class AudioChatService {
  private static instance: AudioChatService;
  private chatService: ChatService;

  private constructor() {
    this.chatService = ChatService.getInstance();
  }

  static getInstance(): AudioChatService {
    if (!AudioChatService.instance) {
      AudioChatService.instance = new AudioChatService();
    }
    return AudioChatService.instance;
  }

  async processAudioInput(audioUriOrText: string, chatHistory: ChatMessage[], userContext?: UserContext): Promise<{
    transcript: AudioTranscript;
    response: AudioChatMessage;
  }> {
    try {
      let transcript: AudioTranscript;
      
      // Check if this is an actual audio URI or just text
      if (audioUriOrText.startsWith('file://') || audioUriOrText.startsWith('content://')) {
        // Actual audio file - transcribe it
        transcript = await AudioRecorder.transcribeAudio(audioUriOrText);
      } else {
        // Text input - create a transcript object
        transcript = {
          text: audioUriOrText,
          confidence: 1.0,
          language: 'en'
        };
      }

      // Generate text response using the main chat service
      const textResponse = await this.chatService.generateResponse(
        transcript.text,
        chatHistory,
        userContext
      );

      // Create audio chat message
      const response: AudioChatMessage = {
        id: `audio-ai-${Date.now()}`,
        content: textResponse.response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: textResponse.sentiment as any,
        isAudioMessage: true,
      };

      return { transcript, response };
    } catch (error) {
      console.error('Error processing audio input:', error);
      throw error;
    }
  }

  async generateAudioResponse(text: string, language: string = 'en'): Promise<string | null> {
    try {
      // For now, we'll use text-to-speech directly
      // In the future, you could call an API to generate more natural AI audio
      return null; // Return null to use text-to-speech instead
    } catch (error) {
      console.error('Error generating audio response:', error);
      return null;
    }
  }

  async speakResponse(text: string, language: string = 'en', onComplete?: () => void): Promise<void> {
    await AudioPlayer.speak(text, language, onComplete);
  }
}