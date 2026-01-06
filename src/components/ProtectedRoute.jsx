import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const [hasProfile, setHasProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has a profile OR is authenticated as admin
    const savedProfile = localStorage.getItem('userProfile');
    const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    
    // If admin is authenticated, allow access
    if (isAdminAuthenticated) {
      setHasProfile(true);
      setLoading(false);
      return;
    }
    
    // Otherwise, check for user profile
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        // Check if profile has required fields (including username for login)
        if (profile.name && profile.email && profile.state && profile.username) {
          setHasProfile(true);
        } else {
          setHasProfile(false);
        }
      } catch (error) {
        console.error('Error parsing profile:', error);
        setHasProfile(false);
      }
    } else {
      setHasProfile(false);
    }
    
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f7f6e4'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '10px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!hasProfile) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;

