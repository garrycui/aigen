import { useState, useEffect, useRef } from 'react';
import { Brain, MessageSquare, BookOpen, Music, Youtube } from 'lucide-react';
import TherapyChat from './TherapyChat';
import JournalSpace from './JournalSpace';
import ContentRecommendations from './ContentRecommendations';
import MeditationSpace from './MeditationSpace';

type Tab = 'therapy' | 'journal' | 'recommendations' | 'meditation';

const Mind = () => {
  const [activeTab, setActiveTab] = useState<Tab>('therapy');
  // Add ref for the content area to scroll into view
  const contentRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: 'therapy', label: 'Supportive AI', icon: MessageSquare },
    { id: 'journal', label: 'Daily Journal', icon: BookOpen },
    { id: 'recommendations', label: 'Uplift Hub', icon: Youtube },
    { id: 'meditation', label: 'Meditation', icon: Music },
  ];

  // Scroll to content area when tab changes
  useEffect(() => {
    if (contentRef.current) {
      // Use a slight delay to ensure DOM updates have completed
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  }, [activeTab]);

  // Handle tab change with a custom function to set the active tab
  const handleTabChange = (tabId: Tab) => {
    setActiveTab(tabId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <Brain className="h-8 w-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Mind Wellness</h1>
        </div>
        <p className="text-gray-600">Your personal space for mental well-being and growth</p>
      </div>

      {/* Tabs */}
      <div className="mb-8" id="mind-tabs">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as Tab)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon
                    className={`
                      -ml-0.5 mr-2 h-5 w-5
                      ${activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}
                    `}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content - Add ref here */}
      <div 
        ref={contentRef} 
        className="min-h-[600px] scroll-mt-20"
        tabIndex={-1}
      >
        {activeTab === 'therapy' && <TherapyChat />}
        {activeTab === 'journal' && <JournalSpace />}
        {activeTab === 'recommendations' && <ContentRecommendations />}
        {activeTab === 'meditation' && <MeditationSpace />}
      </div>
    </div>
  );
};

export default Mind;