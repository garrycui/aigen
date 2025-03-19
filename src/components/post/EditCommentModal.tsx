import React, { useState } from 'react';
import { X } from 'lucide-react';

interface EditCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
  initialContent: string;
  type: 'comment' | 'reply';
}

const EditCommentModal: React.FC<EditCommentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialContent,
  type
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContentValid, setIsContentValid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isContentValid) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(content);
      onClose();
    } catch (error) {
      console.error('Error updating comment:', error);
      setError(`Failed to update ${type}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Edit {type === 'comment' ? 'Comment' : 'Reply'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={4}
                  required
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
                  disabled={isSubmitting || !isContentValid}
                  className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                    isSubmitting || !isContentValid
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

export default EditCommentModal;