
import React from 'react';
import { Calendar, MessageSquare, User } from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  content: string;
  author?: string;
  date?: string;
  commentsCount?: number;
  type: 'post' | 'tutorial';
}

interface AIChatCardProps {
  item: ContentItem;
  onClick: (itemId: string, type: 'post' | 'tutorial') => void;
}

const AIChatCard: React.FC<AIChatCardProps> = ({ item, onClick }) => {
  return (
    <div 
      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 overflow-hidden"
      onClick={() => onClick(item.id, item.type)}
    >
      <div className="p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
          {item.title}
        </h3>
        
        <div className="text-gray-600 text-sm mb-4 line-clamp-3">
          {item.content}
        </div>
        
        <div className="flex items-center text-gray-500 text-xs justify-between mt-4">
          <div className="flex items-center space-x-4">
            {item.author && (
              <div className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                <span>{item.author}</span>
              </div>
            )}
            
            {item.date && (
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                <span>{item.date}</span>
              </div>
            )}
            
            {item.commentsCount !== undefined && (
              <div className="flex items-center">
                <MessageSquare className="h-3 w-3 mr-1" />
                <span>{item.commentsCount} comments</span>
              </div>
            )}
          </div>
          
          <span className={`px-2 py-1 ${item.type === 'post' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'} rounded-full text-xs`}>
            {item.type === 'post' ? 'Post' : 'Tutorial'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIChatCard;