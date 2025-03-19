import React from 'react';
import { X } from 'lucide-react';
import MoodTracker from './MoodTracker';

interface GrowthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const GrowthModal: React.FC<GrowthModalProps> = ({ isOpen, onClose, onUpdate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <MoodTracker onClose={onClose} onUpdate={onUpdate} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrowthModal;