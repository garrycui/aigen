import AsyncStorage from '@react-native-async-storage/async-storage';

interface QuotaData {
  dailyUsage: number;
  lastResetDate: string;
  callHistory: QuotaCall[];
}

interface QuotaCall {
  timestamp: string;
  success: boolean;
  query: string;
}

/**
 * Simple YouTube API quota management
 * Tracks daily usage and prevents exceeding limits
 */
export class SimpleQuotaManager {
  private static instance: SimpleQuotaManager;
  private readonly STORAGE_KEY = 'youtube_quota_simple';
  private readonly DAILY_LIMIT = 5000; // 50 searches per day (100 units each)
  private readonly SEARCH_COST = 100; // YouTube API cost per search
  
  private quotaData: QuotaData = {
    dailyUsage: 0,
    lastResetDate: new Date().toDateString(),
    callHistory: []
  };

  static getInstance(): SimpleQuotaManager {
    if (!SimpleQuotaManager.instance) {
      SimpleQuotaManager.instance = new SimpleQuotaManager();
    }
    return SimpleQuotaManager.instance;
  }

  async init(): Promise<void> {
    await this.loadQuotaData();
  }

  private async loadQuotaData() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Reset if new day
        const today = new Date().toDateString();
        if (data.lastResetDate !== today) {
          data.dailyUsage = 0;
          data.lastResetDate = today;
          data.callHistory = [];
        }
        
        this.quotaData = { ...this.quotaData, ...data };
      }
    } catch (error) {
      console.error('Error loading quota data:', error);
    }
  }

  private async saveQuotaData() {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.quotaData));
    } catch (error) {
      console.error('Error saving quota data:', error);
    }
  }

  canMakeAPICall(): boolean {
    return this.quotaData.dailyUsage < this.DAILY_LIMIT;
  }

  async recordAPICall(query: string, success: boolean): Promise<void> {
    this.quotaData.dailyUsage += this.SEARCH_COST;
    this.quotaData.callHistory.push({
      timestamp: new Date().toISOString(),
      success,
      query
    });

    // Keep last 20 calls
    if (this.quotaData.callHistory.length > 20) {
      this.quotaData.callHistory = this.quotaData.callHistory.slice(-20);
    }

    await this.saveQuotaData();
    
    console.log(`📊 [Quota] API call recorded. Usage: ${this.quotaData.dailyUsage}/${this.DAILY_LIMIT}`);
  }

  getQuotaInfo() {
    const remaining = Math.max(0, this.DAILY_LIMIT - this.quotaData.dailyUsage);
    const percentage = (this.quotaData.dailyUsage / this.DAILY_LIMIT) * 100;
    
    return {
      used: this.quotaData.dailyUsage,
      remaining,
      percentage: percentage.toFixed(1),
      status: percentage > 80 ? 'critical' as const : percentage > 60 ? 'warning' as const : 'healthy' as const
    };
  }

  getDailyStats() {
    const successfulCalls = this.quotaData.callHistory.filter(call => call.success).length;
    const totalCalls = this.quotaData.callHistory.length;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(1) : '0';
    
    return {
      totalCalls,
      successfulCalls,
      successRate: `${successRate}%`,
      remainingCalls: Math.floor(this.getQuotaInfo().remaining / this.SEARCH_COST)
    };
  }
}