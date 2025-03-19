import React from 'react';
import { ExternalLink, Video, FileText } from 'lucide-react';

interface ResourceCardProps {
  type: 'web' | 'video';
  title: string;
  description: string;
  url: string;
  thumbnail?: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  type,
  title,
  description,
  url,
  thumbnail
}) => {
  const cardContent = (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex">
        {thumbnail ? (
          <div className="w-32 h-24">
            <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-32 h-24 bg-gray-100 flex items-center justify-center">
            {type === 'video' ? (
              <Video className="h-8 w-8 text-gray-400" />
            ) : (
              <FileText className="h-8 w-8 text-gray-400" />
            )}
          </div>
        )}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
              {title}
            </h3>
            {/* For video type, keep the external link icon */}
            {type === 'video' && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">
            {description}
          </p>
          <div className="mt-2">
            <span className={`text-xs px-2 py-1 rounded ${type === 'video' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {type === 'video' ? 'Video' : 'Article'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return type === 'web' ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {cardContent}
    </a>
  ) : (
    cardContent
  );
};

export default ResourceCard;