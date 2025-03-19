import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { getLatestAssessment } from '@shared/lib/assessment/assessment';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAssessment = async () => {
      if (user && location.pathname !== '/questionnaire') {
        try {
          const { data: assessment } = await getLatestAssessment(user.id);
          if (!assessment && location.pathname !== '/questionnaire') {
            navigate('/questionnaire');
          } else if (assessment && location.pathname === '/') {
            navigate('/assistant');
          }
        } catch (error) {
          console.error('Error checking assessment:', error);
        }
      }
    };

    checkAssessment();
  }, [user, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;