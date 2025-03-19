import { useState } from 'react';
import { X } from 'lucide-react';
import ContentModeration from './ContentModeration';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: { title: string; content: string; category: string }) => Promise<void>;
  initialData: {
    title: string;
    content: string;
    category: string;
  };
}

const EditPostModal: React.FC<EditPostModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [title, setTitle] = useState(initialData.title);
  const [content, setContent] = useState(initialData.content);
  const [category, setCategory] = useState(initialData.category);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTitleValid, setIsTitleValid] = useState(true);
  const [isContentValid, setIsContentValid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    'Success Stories',
    'Discussion',
    'Tips & Tricks',
    'Challenges',
    'Case Studies'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTitleValid || !isContentValid) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({ title, content, category });
      onClose();
    } catch (error) {
      console.error('Error updating post:', error);
      setError('Failed to update post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Post</h2>
            
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

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isTitleValid || !isContentValid}
                  className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                    isSubmitting || !isTitleValid || !isContentValid
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'hover:bg-indigo-700'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPostModal;