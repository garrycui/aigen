import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  type: 'post' | 'comment' | 'reply';
  isDeleting: boolean;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type,
  isDeleting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
              Delete {type}?
            </h2>
            
            <p className="text-gray-600 text-center mb-6">
              {type === 'post'
                ? 'This will permanently delete your post and all its comments. This action cannot be undone.'
                : type === 'comment'
                ? 'This will permanently delete your comment and all its replies. This action cannot be undone.'
                : 'This will permanently delete your reply. This action cannot be undone.'}
            </p>

            <div className="flex justify-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;