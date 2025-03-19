import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Video} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createPost } from '../../lib/post/post';
import ContentModeration from '../../components/post/ContentModeration';

const NewPost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContentValid, setIsContentValid] = useState(false);
  const [isTitleValid, setIsTitleValid] = useState(false);

  const categories = [
    'Success Stories',
    'Discussion',
    'Tips & Tricks',
    'Challenges',
    'Case Studies'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isContentValid || !isTitleValid) {
      return;
    }

    try {
      setIsSubmitting(true);
      await createPost(user.id, user.name, title, content, category, imageUrl, videoUrl);
      navigate('/forum');
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Share Your AI Story</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your story a compelling title"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <ContentModeration
              content={title}
              onValidationComplete={setIsTitleValid}
              type="title"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your experience with AI..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={10}
              required
            />
            <ContentModeration
              content={content}
              onValidationComplete={setIsContentValid}
              type="content"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Media (Optional)
            </label>
            <div className="space-y-4">
              <div>
                <label htmlFor="imageUrl" className="flex items-center space-x-2 text-gray-600">
                  <Image className="h-5 w-5" />
                  <span>Image URL</span>
                </label>
                <input
                  type="url"
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="videoUrl" className="flex items-center space-x-2 text-gray-600">
                  <Video className="h-5 w-5" />
                  <span>Video URL (YouTube embed)</span>
                </label>
                <input
                  type="url"
                  id="videoUrl"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/embed/..."
                  className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/forum')}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isContentValid || !isTitleValid || !category}
              className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                isSubmitting || !isContentValid || !isTitleValid || !category
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'hover:bg-indigo-700'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Publishing...
                </span>
              ) : (
                'Publish Story'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewPost;