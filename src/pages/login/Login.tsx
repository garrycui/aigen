import React, { useEffect, useState } from 'react';
import { Mail, Lock, AlertCircle, User, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getLatestAssessment } from '../../lib/assessment/assessment';
import PrivacyPolicyModal from '../../components/login/PrivacyPolicyModal';
import TermsModal from '../../components/login/TermsModal';

type ValidationErrors = {
  email?: string;
  password?: string;
  name?: string;
  terms?: string;
};

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, googleSignIn, user, isLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    const checkUserAssessment = async () => {
      // Don't proceed if we've already navigated or if auth is still loading
      if (hasNavigated || isLoading) return;
      
      // Only proceed if we have a valid user
      if (user) {
        try {
          setIsAssessmentLoading(true);
          const { data: assessment } = await getLatestAssessment(user.id);
          
          // Prevent multiple navigations
          setHasNavigated(true);
          
          // Only navigate when assessment check is complete
          if (assessment) {
            navigate('/assistant', { replace: true });
          } else {
            navigate('/questionnaire', { replace: true });
          }
        } catch (error) {
          console.error('Error checking assessment:', error);
          // Only navigate if we haven't already
          if (!hasNavigated) {
            setHasNavigated(true);
            navigate('/questionnaire', { replace: true });
          }
        } finally {
          setIsAssessmentLoading(false);
        }
      }
    };

    checkUserAssessment();
  }, [user, isLoading, navigate, hasNavigated]);

  // Add a combined loading state for UI
  const isPageLoading = isLoading || isAssessmentLoading;

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    let isValid = true;

    if (!email) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'Password should be at least 6 characters';
      isValid = false;
    }

    if (!isLogin) {
      if (!name.trim()) {
        errors.name = 'Full name is required';
        isValid = false;
      }
      
      if (!acceptedTerms) {
        errors.terms = 'You must accept the Terms of Service and Privacy Policy';
        isValid = false;
      }
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError);
          return;
        }
      } else {
        const { error: signUpError } = await signUp(email, password, name);
        if (signUpError) {
          setError(signUpError);
          return;
        }
        setSignUpSuccess(true);
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setError(error?.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setValidationErrors({});
    setIsSubmitting(true);

    try {
      const { error } = await googleSignIn();
      if (error) {
        setError(error);
      }
      // The auth state listener will handle redirect on success
    } catch (error: any) {
      console.error('Google authentication error:', error);
      setError(error?.message || 'An unexpected error occurred with Google sign-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setValidationErrors({});
    setPassword('');
  };

  const renderErrorMessage = (message: string) => (
    <div className="flex items-start mt-1">
      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-1" />
      <span className="text-sm text-red-600">{message}</span>
    </div>
  );

  return (
    <div className="max-w-md mx-auto">
      {signUpSuccess ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-4 text-green-500">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Account Created Successfully</h2>
          <p className="text-gray-600 mb-6">
            You can now sign in with your email and password.
          </p>
          <button
            onClick={() => {
              setSignUpSuccess(false);
              setIsLogin(true);
              setEmail('');
              setPassword('');
            }}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Return to Sign In
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-600">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="text-sm text-red-600 hover:text-red-800 font-medium mt-2"
              >
                Try again
              </button>
            </div>
          )}
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
                {isLogin ? 'Welcome Back' : 'Start Your Journey'}
              </h2>

              <div className="flex border-b border-gray-200 mb-6">
                <button
                  className={`flex-1 py-2 text-center ${
                    isLogin
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    setIsLogin(true);
                    setValidationErrors({});
                    setError('');
                  }}
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 py-2 text-center ${
                    !isLogin
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    setIsLogin(false);
                    setValidationErrors({});
                    setError('');
                  }}
                >
                  Sign Up
                </button>
              </div>
              
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting || isPageLoading}
                  className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {isSubmitting || isPageLoading ? 'Processing...' : 'Continue with Google'}
                </button>
              </div>
              
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="name"
                        type="text"
                        required={!isLogin}
                        className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                          validationErrors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <User className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                      {validationErrors.name && renderErrorMessage(validationErrors.name)}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="email"
                      type="email"
                      required
                      className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        validationErrors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Mail className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                  {validationErrors.email && renderErrorMessage(validationErrors.email)}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      type="password"
                      required
                      className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        validationErrors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Lock className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                  {validationErrors.password && renderErrorMessage(validationErrors.password)}
                  {!isLogin && !validationErrors.password && (
                    <p className="mt-2 text-sm text-gray-500">
                      Password must be at least 6 characters long.
                    </p>
                  )}
                </div>

                {!isLogin && (
                  <>
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-indigo-800 mb-2">
                        Start with a Free Trial
                      </h3>
                      <ul className="text-sm text-indigo-700 space-y-1">
                        <li>✓ 7 days of full access</li>
                        <li>✓ No credit card required for trial</li>
                        <li>✓ Cancel anytime</li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="terms"
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3">
                          <label htmlFor="terms" className="text-sm text-gray-600">
                            I agree to the{' '}
                            <button
                              type="button"
                              onClick={() => setShowTermsModal(true)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Terms of Service
                            </button>
                            {' '}and{' '}
                            <button
                              type="button"
                              onClick={() => setShowPrivacyModal(true)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Privacy Policy
                            </button>
                          </label>
                        </div>
                      </div>
                      {validationErrors.terms && renderErrorMessage(validationErrors.terms)}
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Shield className="h-4 w-4" />
                      <span>Your data is protected by industry-standard encryption</span>
                    </div>
                  </>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || isPageLoading}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      isSubmitting || isPageLoading
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                  >
                    {isSubmitting || isPageLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      isLogin ? 'Sign in' : 'Start Free Trial'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </div>
  );
};

export default Login;