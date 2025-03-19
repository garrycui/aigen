import React, { useState, useEffect, useCallback, memo } from 'react';
import { useAuth } from '@context/AuthContext';
import { User } from 'lucide-react';
import { updateUser, getUser } from '@shared/lib/common/cache';
import { auth } from '@shared/lib/common/firebase';
import { updateProfile } from 'firebase/auth';

// Define proper TypeScript interface for FormField props
interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
}

// Create reusable, memoized form field components with proper typing
const FormField = memo(({ 
  label, 
  name, 
  value, 
  onChange, 
  type = 'text', 
  disabled = false,
  required = false 
}: FormFieldProps) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className={`w-full p-2 border border-gray-300 rounded-lg ${
        disabled ? 'bg-gray-50' : 'focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
      }`}
    />
  </div>
));

// Skeleton loading component
const ProfileSkeleton = () => (
  <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-gray-200 p-3 rounded-full h-12 w-12"></div>
          <div>
            <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end mt-6">
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    </div>
  </div>
);

const UserProfile = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    jobTitle: '',
    company: '',
    location: '',
    website: '',
    twitter: '',
    linkedin: ''
  });
  
  // Track which fields have been modified
  const [dirtyFields, setDirtyFields] = useState<Record<string, boolean>>({});
  
  // Fix useCallback by adding all required dependencies
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setDirtyFields(prev => ({ ...prev, [name]: true }));
    
    // Clear any error message when user starts typing
    if (message?.type === 'error') {
      setMessage(null);
    }
  }, [message]);

  // Safe user data fetching with error handling
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        // Load user data directly from cache first for immediate rendering
        const userData = await getUser(user.id);
        
        if (userData) {
          setFormData({
            name: userData.name || '',
            email: userData.email || '',
            bio: userData.bio || '',
            jobTitle: userData.jobTitle || '',
            company: userData.company || '',
            location: userData.location || '',
            website: userData.website || '',
            twitter: userData.twitter || '',
            linkedin: userData.linkedin || ''
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        setMessage({
          text: 'Failed to load profile data. Please try again later.',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user?.id]);

  // Fix useCallback by adding proper dependency array and type safety
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      setIsSubmitting(true);
      setMessage(null);

      // Update Firebase Auth profile if name changed
      if (dirtyFields.name) {
        const authUser = auth.currentUser;
        if (authUser) {
          try {
            await updateProfile(authUser, {
              displayName: formData.name
            });
          } catch (authError) {
            console.error('Error updating auth profile:', authError);
            // Continue with Firestore updates even if auth update fails
          }
        }
      }

      // Only update fields that have been modified
      const updates: Record<string, any> = {};
      Object.keys(dirtyFields).forEach(key => {
        if (dirtyFields[key] && key !== 'email') { // Skip email as it's read-only
          updates[key] = formData[key as keyof typeof formData];
        }
      });

      // Only make the API call if there are changes
      if (Object.keys(updates).length > 0) {
        await updateUser(user.id, updates);
        setMessage({text: 'Profile updated successfully!', type: 'success'});
        // Reset dirty fields after successful save
        setDirtyFields({});
      } else {
        setMessage({text: 'No changes to save', type: 'success'});
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({text: 'Failed to update profile', type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, formData, dirtyFields]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="bg-indigo-100 p-3 rounded-full">
              <User className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
              <p className="text-gray-600">Manage your account information and preferences</p>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required={true}
              />

              <FormField
                label="Email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                type="email"
                disabled={true}
              />

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={4}
                />
              </div>

              {/* Other form fields - using FormField component */}
              <FormField
                label="Job Title"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
              />

              <FormField
                label="Company"
                name="company"
                value={formData.company}
                onChange={handleChange}
              />

              <FormField
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleChange}
              />

              <FormField
                label="Website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                type="url"
              />

              <FormField
                label="Twitter"
                name="twitter"
                value={formData.twitter}
                onChange={handleChange}
              />

              <FormField
                label="LinkedIn"
                name="linkedin"
                value={formData.linkedin}
                onChange={handleChange}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="submit"
                disabled={isSubmitting || Object.keys(dirtyFields).length === 0}
                className={`px-6 py-2 text-white rounded-lg transition-colors ${
                  isSubmitting || Object.keys(dirtyFields).length === 0 
                    ? 'bg-indigo-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
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

export default memo(UserProfile);