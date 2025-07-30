export interface AudioTranscript {
    text: string;
    confidence: number;
    language?: string;
  }
  
  export class AudioRecorder {
    private static isRecording = false;
    private static recordingStartTime = 0;
  
    static async requestPermissions(): Promise<boolean> {
      // Mock permission request - always grant
      console.log('Mock: Requesting audio permissions');
      return true;
    }
  
    static async startRecording(): Promise<void> {
      try {
        if (this.isRecording) return;
        
        console.log('Mock: Starting audio recording');
        this.isRecording = true;
        this.recordingStartTime = Date.now();
      } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
      }
    }
  
    static async stopRecording(): Promise<string | null> {
      try {
        if (!this.isRecording) return null;
  
        console.log('Mock: Stopping audio recording');
        this.isRecording = false;
        const duration = Date.now() - this.recordingStartTime;
        console.log(`Mock recording duration: ${duration}ms`);
        
        return `mock-audio-recording-${Date.now()}`;
      } catch (error) {
        console.error('Error stopping recording:', error);
        return null;
      }
    }
  
    static async transcribeAudio(audioUri: string): Promise<AudioTranscript> {
      try {
        console.log('Mock: Transcribing audio from:', audioUri);
        
        // Mock transcripts based on recording duration simulation
        const mockTranscripts = [
          "Hello, how can I help you today?",
          "What is artificial intelligence and how does it work?",
          "Can you explain machine learning in simple terms?",
          "I'm interested in learning about AI technology.",
          "Tell me about the future of artificial intelligence.",
          "How will AI change the way we work?",
          "What are the benefits and risks of AI?",
          "Can you help me understand neural networks?"
        ];
        
        const randomTranscript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
          text: randomTranscript,
          confidence: 0.92,
          language: 'en'
        };
      } catch (error) {
        console.error('Error transcribing audio:', error);
        return {
          text: 'Could not transcribe audio',
          confidence: 0.0,
          language: 'en'
        };
      }
    }
  
    static getIsRecording(): boolean {
      return this.isRecording;
    }
  
    static async initialize(): Promise<void> {
      console.log('Mock: Audio recorder initialized');
    }
  
    static async destroy(): Promise<void> {
      console.log('Mock: Audio recorder destroyed');
      this.isRecording = false;
    }
  }