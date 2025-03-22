import { useState, useEffect } from 'react';
import { Search, Filter, Book, Plus } from 'lucide-react';
import TutorialList from '@components/tutorial/TutorialList';
import GenerateTutorialModal from '@components/tutorial/GenerateTutorialModal';
import { getUICategories, getUIDifficultyLevels } from '@shared/lib/tutorial/tutorials';

const CATEGORIES = getUICategories();
const DIFFICULTY_LEVELS = getUIDifficultyLevels();

const Tutorials = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const handleCategoryToggle = (category: string) => {
    if (category === 'All') {
      setSelectedCategories([]);
      return;
    }
    
    setSelectedCategories(prev => {
      const isSelected = prev.includes(category);
      if (isSelected) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleDifficultyToggle = (difficulty: string) => {
    if (difficulty === 'All') {
      setSelectedDifficulties([]);
      return;
    }
    
    setSelectedDifficulties(prev => {
      const isSelected = prev.includes(difficulty);
      if (isSelected) {
        return prev.filter(d => d !== difficulty);
      } else {
        return [...prev, difficulty];
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Adaptation Tutorials</h1>
            <p className="text-gray-600">Learn and master AI tools with step-by-step guides</p>
          </div>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Generate Tutorial
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tutorials..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters {showFilters ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Category Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleCategoryToggle(category)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        category === 'All'
                          ? selectedCategories.length === 0
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : selectedCategories.includes(category)
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty Levels
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTY_LEVELS.map((difficulty) => (
                    <button
                      key={difficulty}
                      onClick={() => handleDifficultyToggle(difficulty)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        difficulty === 'All'
                          ? selectedDifficulties.length === 0
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : selectedDifficulties.includes(difficulty)
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tutorial Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {CATEGORIES.slice(1).map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryToggle(category)}
            className={`p-6 rounded-lg border-2 transition-colors ${
              selectedCategories.includes(category)
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-600 hover:bg-indigo-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Book className={`h-6 w-6 ${
                selectedCategories.includes(category) ? 'text-indigo-600' : 'text-gray-500'
              }`} />
              <span className={`font-medium ${
                selectedCategories.includes(category) ? 'text-indigo-600' : 'text-gray-900'
              }`}>
                {category}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* TutorialList with multi-select filters */}
      <TutorialList
        searchQuery={debouncedSearchQuery}
        categories={selectedCategories}
        difficulties={selectedDifficulties}
      />

      <GenerateTutorialModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
      />
    </div>
  );
};

export default Tutorials;