import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import ForumList from '@components/post/ForumList';

const Forum = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'likes' | 'comments'>('date');
  const [page, setPage] = useState(1);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header with title and share button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Forum</h1>
          <p className="text-gray-600">Discover Every Empowering Insight</p>
        </div>
        <Link
          to="/forum/new"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Share Your Story
        </Link>
      </div>

      {/* Search and Sort Container */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>
      
      {/* Sort Dropdown */}
      <div className="flex justify-end mb-6">
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as 'date' | 'likes' | 'comments');
            setPage(1);
          }}
          className="border rounded p-2 text-sm"
        >
          <option value="date">Date</option>
          <option value="likes">Likes</option>
          <option value="comments">Comments</option>
        </select>
      </div>

      {/* ForumList component */}
      <ForumList
        searchQuery={debouncedSearchQuery}
        sortBy={sortBy}
        page={page}
      />
    </div>
  );
};

export default Forum;