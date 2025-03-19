import React, { useState, useEffect, useCallback, memo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, Bell, Lock } from 'lucide-react';
import { getUser, updateUser } from '../../lib/common/cache';
import { userCache } from '../../lib/common/cache'; // Import cache for performance optimization

// Common timezones list to use as fallback
const commonTimezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland'
];

// Helper function to get available timezones
const getAvailableTimezones = (): string[] => {
  try {
    // Use type assertion to bypass TypeScript error
    const intlWithSupport = Intl as any;
    if (typeof intlWithSupport.supportedValuesOf === 'function') {
      return intlWithSupport.supportedValuesOf('timeZone');
    }
  } catch (error) {
    console.warn('Intl.supportedValuesOf not available, using fallback timezone list');
  }
  return commonTimezones;
};

// Create reusable CheckboxSetting component
const CheckboxSetting = memo(({ 
  label, 
  description, 
  checked, 
  onChange 
}: { 
  label: string, 
  description: string, 
  checked: boolean, 
  onChange: (checked: boolean) => void 
}) => (
  <div className="flex items-center justify-between">
    <div>
      <label className="font-medium text-gray-700">{label}</label>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
    />
  </div>
));

// Skeleton loading component for settings
const SettingsSkeleton = () => (
  <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-gray-200 p-3 rounded-full h-12 w-12"></div>
          <div>
            <div className="h-6 bg-gray-200 rounded w-36 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
        </div>
        
        {/* Sections skeleton */}
        {[...Array(3)].map((_, sectionIndex) => (
          <div key={sectionIndex} className="mb-8">
            <div className="h-5 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, itemIndex) => (
                <div key={itemIndex} className="flex items-center justify-between">
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-36 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-48"></div>
                  </div>
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <div className="flex justify-end mt-6">
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    </div>
  </div>
);

const UserSettings = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  
  // Split settings state into smaller chunks for better performance
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    push: true,
    weeklyDigest: true,
    newFeatures: true
  });
  
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    showActivity: true,
    showProgress: true
  });
  
  const [preferenceSettings, setPreferenceSettings] = useState({
    theme: 'light',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  
  // Track if any changes have been made
  const [hasChanges, setHasChanges] = useState(false);

  // Group settings for cache key and dirty checking
  const allSettings = {
    notifications: notificationSettings,
    privacy: privacySettings,
    preferences: preferenceSettings
  };

  // Cache key to optimize repeated loads
  const settingsCacheKey = user?.id ? `user-settings-${user.id}` : null;

  // Define notification setting handlers with useCallback
  const handleNotificationChange = useCallback((key: string, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
    
    // Clear success message when changes are made
    if (message?.type === 'success') {
      setMessage(null);
    }
  }, [message]);

  // Define privacy setting handlers
  const handlePrivacyChange = useCallback((key: string, value: boolean | string) => {
    setPrivacySettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
    
    if (message?.type === 'success') {
      setMessage(null);
    }
  }, [message]);

  // Define preference setting handlers
  const handlePreferenceChange = useCallback((key: string, value: string) => {
    setPreferenceSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
    
    if (message?.type === 'success') {
      setMessage(null);
    }
  }, [message]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        
        // Try to get settings from memory cache first (super fast)
        const cachedSettings = settingsCacheKey ? userCache.get(settingsCacheKey) : null;
        
        if (cachedSettings) {
          setNotificationSettings(cachedSettings.notifications);
          setPrivacySettings(cachedSettings.privacy);
          setPreferenceSettings(cachedSettings.preferences);
          setIsLoading(false);
          return;
        }
        
        // If not in memory cache, get from user data
        const userData = await getUser(user.id);
        
        if (userData?.settings) {
          const { notifications, privacy, preferences } = userData.settings;
          
          if (notifications) setNotificationSettings(notifications);
          if (privacy) setPrivacySettings(privacy);
          if (preferences) setPreferenceSettings(preferences);
          
          // Store in memory cache for faster subsequent accesses
          if (settingsCacheKey) {
            userCache.set(settingsCacheKey, userData.settings, 60000); // 1 minute TTL
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        setMessage({text: 'Failed to load settings', type: 'error'});
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user?.id, settingsCacheKey]);

  // Optimized submit handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !hasChanges) return;

    try {
      setIsSubmitting(true);
      setMessage(null);

      await updateUser(user.id, {
        settings: allSettings
      });
      
      // Update the memory cache
      if (settingsCacheKey) {
        userCache.set(settingsCacheKey, allSettings, 60000); // 1 minute TTL
      }

      setMessage({text: 'Settings saved successfully!', type: 'success'});
      setHasChanges(false);
    } catch (error) {
      console.error('Error updating settings:', error);
      setMessage({text: 'Failed to update settings', type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, allSettings, hasChanges, settingsCacheKey]);

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="bg-indigo-100 p-3 rounded-full">
              <Settings className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600">Manage your preferences and account settings</p>
            </div>
          </div>

          {message && (
            <div className={`mb-6 p-4 ${
              message.type === 'error' 
                ? 'bg-red-50 border border-red-200 text-red-700' 
                : 'bg-green-50 border border-green-200 text-green-700'
              } rounded-lg`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Notification Settings */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notification Settings
              </h2>
              <div className="space-y-4">
                <CheckboxSetting
                  label="Email Notifications"
                  description="Receive updates via email"
                  checked={notificationSettings.email}
                  onChange={(checked) => handleNotificationChange('email', checked)}
                />

                <CheckboxSetting
                  label="Weekly Digest"
                  description="Get a summary of your progress"
                  checked={notificationSettings.weeklyDigest}
                  onChange={(checked) => handleNotificationChange('weeklyDigest', checked)}
                />

                <CheckboxSetting
                  label="New Features"
                  description="Be notified about new features"
                  checked={notificationSettings.newFeatures}
                  onChange={(checked) => handleNotificationChange('newFeatures', checked)}
                />
              </div>
            </div>

            {/* Privacy Settings */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Privacy Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="font-medium text-gray-700">Profile Visibility</label>
                  <select
                    value={privacySettings.profileVisibility}
                    onChange={(e) => handlePrivacyChange('profileVisibility', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="members">Members Only</option>
                  </select>
                </div>

                <CheckboxSetting
                  label="Show Activity"
                  description="Display your learning activity"
                  checked={privacySettings.showActivity}
                  onChange={(checked) => handlePrivacyChange('showActivity', checked)}
                />

                <CheckboxSetting
                  label="Show Progress"
                  description="Display your learning progress"
                  checked={privacySettings.showProgress}
                  onChange={(checked) => handlePrivacyChange('showProgress', checked)}
                />
              </div>
            </div>

            {/* Preferences */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Preferences
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="font-medium text-gray-700">Theme</label>
                  <select
                    value={preferenceSettings.theme}
                    onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select> </div>

                <div>
                  <label className="font-medium text-gray-700">Language</label>
                  <select
                    value={preferenceSettings.language}
                    onChange={(e) => handlePreferenceChange('language', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-gray-700">Timezone</label>
                  <select
                    value={preferenceSettings.timezone}
                    onChange={(e) => handlePreferenceChange('timezone', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {getAvailableTimezones().map((timezone: string) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="submit"
                disabled={isSubmitting || !hasChanges}
                className={`px-6 py-2 text-white rounded-lg transition-colors ${
                  isSubmitting || !hasChanges ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default memo(UserSettings);