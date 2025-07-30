export class AudioPlayer {
    private static isPlaying = false;
  
    static async speak(text: string, language: string = 'en', onComplete?: () => void): Promise<void> {
      try {
        console.log('Mock: Speaking text:', text);
        this.isPlaying = true;
  
        // Simulate speech duration based on text length
        const duration = Math.max(1000, text.length * 50); // 50ms per character, min 1 second
        
        setTimeout(() => {
          this.isPlaying = false;
          if (onComplete) onComplete();
        }, duration);
  
      } catch (error) {
        console.error('Error in mock text-to-speech:', error);
        this.isPlaying = false;
        if (onComplete) onComplete();
      }
    }
  
    static async playAudioResponse(audioUri: string, onComplete?: () => void): Promise<void> {
      try {
        console.log('Mock: Playing audio response for:', audioUri);
        this.isPlaying = true;
        
        // Simulate playback duration
        setTimeout(() => {
          this.isPlaying = false;
          if (onComplete) onComplete();
        }, 2000);
        
      } catch (error) {
        console.error('Error playing mock audio:', error);
        this.isPlaying = false;
        if (onComplete) onComplete();
      }
    }
  
    static stop(): void {
      console.log('Mock: Stopping audio playback');
      this.isPlaying = false;
    }
  
    static getIsPlaying(): boolean {
      return this.isPlaying;
    }
  }