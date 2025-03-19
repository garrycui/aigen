import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Users, LayoutDashboard, Menu, X, LogOut, Bot, ChevronDown, BookOpen, Heart } from 'lucide-react';
import { useAuth } from '@context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const NavLinks = () => (
    <>
      {user ? (
        <>
          <Link 
            to="/assistant" 
            className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <Bot className="h-4 w-4" />
            <span>AI Companion</span>
          </Link>
          <Link 
            to="/tutorials" 
            className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <BookOpen className="h-4 w-4" />
            <span>Tutorials</span>
          </Link>
          <Link 
            to="/mind" 
            className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <Heart className="h-4 w-4" />
            <span>Mind</span>
          </Link>
          <Link 
            to="/forum" 
            className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <Users className="h-4 w-4" />
            <span>Community</span>
          </Link>
          <Link 
            to="/dashboard" 
            className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            >
              <span className="font-medium">{user.name}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <Link
                  to="/assessment/summary"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsMenuOpen(false);
                  }}
                >
                  Your Assessment
                </Link>
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsMenuOpen(false);
                  }}
                >
                  Profile
                </Link>
                <Link
                  to="/subscription"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsMenuOpen(false);
                  }}
                >
                  Subscription
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsMenuOpen(false);
                  }}
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsUserMenuOpen(false);
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-2">
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <Link
          to="/login"
          className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
          onClick={() => setIsMenuOpen(false)}
        >
          <span>Sign In</span>
        </Link>
      )}
    </>
  );

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Brain className="h-8 w-8 text-indigo-600" />
            <span className="text-xl font-bold text-gray-800">Thrive</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <NavLinks />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t">
            <div className="flex flex-col space-y-4 p-4">
              <NavLinks />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;