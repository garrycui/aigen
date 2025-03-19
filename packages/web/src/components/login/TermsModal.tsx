import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  const [terms, setTerms] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return; // Load only when modal is opened
    fetch('/docs/Aigen_Terms_of_use.html')
      .then(response => response.text())
      .then(data => setTerms(data))
      .catch(error => console.error('Error loading terms of use:', error));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 md:mx-auto">
        {/* Close Button */}
        <div className="absolute right-4 top-4">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Terms of Use</h2>
          <div className="prose max-w-none text-sm leading-6" dangerouslySetInnerHTML={{ __html: terms }} />
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
