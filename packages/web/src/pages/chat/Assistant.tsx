import AIChat from '@components/chat/AIChat';
import DailyContent from '@components/dailyContent/DailyContent';

const Assistant = () => {

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Daily Inspiration */}
        <DailyContent />
        
        {/* AI Chat Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">How can I help you today?</h2>
          </div>
          <AIChat />
        </div>
      </div>
    </div>
  );
};

export default Assistant;