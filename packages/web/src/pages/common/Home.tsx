import { Link } from 'react-router-dom';
import { Brain, Rocket, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@context/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="relative">
      {/* Video Background */}
      <div className="absolute inset-0 w-full h-screen overflow-hidden">
        <div className="absolute inset-0 bg-black/50 z-10" /> {/* Overlay */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          poster="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80"
        >
          <source
            src="/videos/background.mp4"
            type="video/mp4"
          />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Hero Section */}
      <div className="relative z-20 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pt-20 pb-12 md:pt-32 text-center">
            <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
              Empower Your Mind,
              <span className="block text-indigo-400">Lead in the AI Era</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-300">
              Discover your unique AI adaptation style and get personalized guidance to thrive in the age of artificial intelligence.
            </p>
            <div className="mt-10">
              {user ? (
                <div className="flex justify-center gap-x-6">
                  <Link
                    to="/questionnaire"
                    className="group inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200"
                  >
                    Start Your Journey
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/forum"
                    className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-100 bg-indigo-600/20 hover:bg-indigo-600/30 transition-all duration-200"
                  >
                    Join Community
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-y-4">
                  <Link
                    to="/login"
                    className="group inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <p className="text-gray-300">
                    Already have an account?{' '}
                    <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
                      Sign in
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Features Section */}
          <div className="mt-32 pb-20">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
              <div className="relative group">
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 opacity-25 group-hover:opacity-50 transition-opacity blur" />
                <div className="relative p-8 bg-black/40 rounded-lg backdrop-blur-sm border border-white/10">
                  <div className="flex justify-center mb-6">
                    <Brain className="h-12 w-12 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white text-center mb-4">Personalized Insights</h3>
                  <p className="text-gray-300 text-center">
                    Get a deep understanding of your AI adaptation style through our advanced personality assessment.
                  </p>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 opacity-25 group-hover:opacity-50 transition-opacity blur" />
                <div className="relative p-8 bg-black/40 rounded-lg backdrop-blur-sm border border-white/10">
                  <div className="flex justify-center mb-6">
                    <Rocket className="h-12 w-12 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white text-center mb-4">Guided Learning</h3>
                  <p className="text-gray-300 text-center">
                    Access curated resources and step-by-step guidance to enhance your AI skills effectively.
                  </p>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-pink-600 to-indigo-600 opacity-25 group-hover:opacity-50 transition-opacity blur" />
                <div className="relative p-8 bg-black/40 rounded-lg backdrop-blur-sm border border-white/10">
                  <div className="flex justify-center mb-6">
                    <Users className="h-12 w-12 text-pink-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white text-center mb-4">Community Support</h3>
                  <p className="text-gray-300 text-center">
                    Connect with peers, share experiences, and learn from others on similar AI adaptation journeys.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center pb-20">
            <div className="relative group inline-block">
              <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-30 group-hover:opacity-100 transition-all duration-500 blur-lg group-hover:blur" />
              <Link
                to="/questionnaire"
                className="relative inline-flex items-center px-8 py-4 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all duration-200"
              >
                Begin Your Assessment
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;