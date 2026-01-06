import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiUser, FiMail, FiLogIn, FiAlertCircle } from 'react-icons/fi';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Removed auto-redirect - login page should always show first
  // Users can manually log in, and ProtectedRoute will handle access to protected routes

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.username.trim() || !formData.email.trim()) {
      setError('Please enter both username and email');
      return;
    }

    setLoading(true);
    console.log('Login - Attempting login with:', {
      username: formData.username,
      email: formData.email
    });
    
    try {
      // Check for super admin login (ironlady / superadmin@gmail.com)
      const usernameLower = formData.username.toLowerCase().trim();
      const emailLower = formData.email.toLowerCase().trim();
      const isSuperAdminLogin = usernameLower === 'ironlady' && 
                                emailLower === 'superadmin@gmail.com';
      
      console.log('Login - Super admin check:', {
        usernameLower,
        emailLower,
        isSuperAdminLogin,
        usernameMatch: usernameLower === 'ironlady',
        emailMatch: emailLower === 'superadmin@gmail.com'
      });
      
      if (isSuperAdminLogin) {
        console.log('Login - Processing super admin login...');
        // Super admin login - create/update profile
        const superAdminProfile = {
          id: 'superadmin',
          name: 'IronLady',
          email: 'superadmin@gmail.com',
          username: 'ironlady',
          state: null, // Super admin doesn't need a state
          isAdmin: true,
          isSuperAdmin: true
        };
        
        // Check if super admin exists in Firestore, if not create it
        try {
          console.log('Login - Checking Firestore for super admin...');
          const superAdminQuery = query(
            collection(db, 'users'),
            where('email', '==', 'superadmin@gmail.com')
          );
          const superAdminSnapshot = await getDocs(superAdminQuery);
          
          console.log('Login - Firestore query result:', {
            empty: superAdminSnapshot.empty,
            docsCount: superAdminSnapshot.docs.length
          });
          
          if (superAdminSnapshot.empty) {
            // Create super admin in Firestore
            console.log('Login - Creating super admin in Firestore...');
            const { addDoc } = await import('firebase/firestore');
            const newDocRef = await addDoc(collection(db, 'users'), {
              name: 'IronLady',
              email: 'superadmin@gmail.com',
              username: 'ironlady',
              state: null,
              isAdmin: true,
              isSuperAdmin: true,
              createdAt: new Date()
            });
            superAdminProfile.id = newDocRef.id;
            console.log('Login - Super admin created in Firestore with ID:', newDocRef.id);
            console.log('Login - Super admin data saved to Firestore:', {
              id: newDocRef.id,
              name: 'IronLady',
              email: 'superadmin@gmail.com',
              username: 'ironlady',
              isAdmin: true,
              isSuperAdmin: true
            });
          } else {
            // Update existing super admin - ensure it's always super admin
            console.log('Login - Updating existing super admin in Firestore...');
            const { updateDoc, doc } = await import('firebase/firestore');
            const existingDoc = superAdminSnapshot.docs[0];
            const existingData = existingDoc.data();
            
            console.log('Login - Existing super admin data:', existingData);
            
            // Always update to ensure super admin status
            await updateDoc(doc(db, 'users', existingDoc.id), {
              name: 'IronLady',
              email: 'superadmin@gmail.com',
              username: 'ironlady',
              state: null,
              isAdmin: true,
              isSuperAdmin: true,
              updatedAt: new Date()
            });
            superAdminProfile.id = existingDoc.id;
            console.log('Login - Super admin updated in Firestore with ID:', existingDoc.id);
            console.log('Login - Super admin data updated in Firestore:', {
              id: existingDoc.id,
              name: 'IronLady',
              email: 'superadmin@gmail.com',
              username: 'ironlady',
              isAdmin: true,
              isSuperAdmin: true
            });
          }
        } catch (firestoreError) {
          console.error('Login - Firestore error:', firestoreError);
          console.error('Login - Firestore error details:', {
            code: firestoreError.code,
            message: firestoreError.message
          });
          // Continue anyway - save to localStorage
          console.log('Login - Continuing with localStorage only due to Firestore error');
        }
        
        // ALWAYS save to localStorage, even if Firestore fails
        try {
          localStorage.setItem('userProfile', JSON.stringify(superAdminProfile));
          console.log('Login - Super admin profile saved to localStorage:', superAdminProfile);
          
          // Automatically authenticate superadmin for admin dashboard access
          sessionStorage.setItem('adminAuthenticated', 'true');
          console.log('Login - Super admin authenticated for admin dashboard');
          
          // Dispatch custom event to update other components
          window.dispatchEvent(new Event('profileUpdated'));
          
          // Small delay to ensure localStorage is saved
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('Login - Redirecting to feed...');
          navigate('/feed');
        } catch (localStorageError) {
          console.error('Login - Error saving to localStorage:', localStorageError);
          setError('Error saving profile. Please try again.');
        } finally {
          setLoading(false);
        }
        return;
      }

      // Regular user login - search for user by username (case-insensitive)
      console.log('Login - Attempting regular user login...');
      const usernameQuery = query(
        collection(db, 'users'),
        where('username', '==', formData.username.toLowerCase().trim())
      );
      const usernameSnapshot = await getDocs(usernameQuery);

      if (usernameSnapshot.empty) {
        console.log('Login - Username not found in Firestore');
        setError('Invalid username or email. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Check if email matches
      const userDoc = usernameSnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('Login - User found in Firestore:', {
        username: userData.username,
        email: userData.email,
        isAdmin: userData.isAdmin,
        isSuperAdmin: userData.isSuperAdmin
      });
      
      if (userData.email.toLowerCase().trim() !== formData.email.toLowerCase().trim()) {
        console.log('Login - Email mismatch');
        setError('Invalid username or email. Please check your credentials.');
        setLoading(false);
        return;
      }

      // IMPORTANT: Ensure only superadmin@gmail.com with username ironlady can be admin
      // Remove admin status from any other account
      const isActuallySuperAdmin = userData.email === 'superadmin@gmail.com' && 
                                  userData.username === 'ironlady';
      
      // Login successful - save profile to localStorage
      const profileData = {
        id: userDoc.id,
        name: userData.name,
        email: userData.email,
        username: userData.username,
        state: userData.state,
        // Only set admin flags if this is the actual superadmin account
        isAdmin: isActuallySuperAdmin ? true : false,
        isSuperAdmin: isActuallySuperAdmin ? true : false
      };

      // Update Firestore to ensure only superadmin has admin rights
      if (!isActuallySuperAdmin && (userData.isAdmin || userData.isSuperAdmin)) {
        console.log('Login - Removing admin status from non-superadmin account');
        try {
          const { updateDoc, doc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', userDoc.id), {
            isAdmin: false,
            isSuperAdmin: false,
            updatedAt: new Date()
          });
        } catch (updateError) {
          console.error('Login - Error updating admin status:', updateError);
        }
      }

      localStorage.setItem('userProfile', JSON.stringify(profileData));
      console.log('Login - Regular user profile saved:', profileData);
      
      // Only set admin authentication for actual superadmin
      if (isActuallySuperAdmin) {
        sessionStorage.setItem('adminAuthenticated', 'true');
        console.log('Login - Superadmin authenticated for admin dashboard');
      }
      
      // Dispatch custom event to update other components
      window.dispatchEvent(new Event('profileUpdated'));
      
      // Redirect to feed
      console.log('Login - Login successful, redirecting to feed');
      navigate('/feed');
    } catch (error) {
      console.error('Error during login:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      setError(`Error during login: ${error.message || 'Please check your connection and try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f7f6e4',
      padding: '20px'
    }}>
      <div style={{ 
        maxWidth: '450px', 
        width: '100%',
        background: '#f52929',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        border: '2px solid #dc2626'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            padding: '5px',
            overflow: 'hidden'
          }}>
            <img 
              src="/logo.png" 
              alt="Iron Lady Logo" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                borderRadius: '50%'
              }} 
            />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
            Welcome Back
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px' }}>
            Login to your IronLady Community account
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#dc2626'
          }}>
            <FiAlertCircle size={18} />
            <span style={{ fontSize: '14px' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 600, 
              color: 'white',
              fontSize: '14px'
            }}>
              <FiUser style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                setFormData({ ...formData, username: value });
                console.log('Login - Username input:', value);
              }}
              placeholder="Enter your username"
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '15px',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6b46c1'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 600, 
              color: 'white',
              fontSize: '14px'
            }}>
              <FiMail style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter your email"
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '15px',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6b46c1'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.transform = 'translateY(-2px)';
              if (!loading) e.target.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}></div>
                Logging in...
              </>
            ) : (
              <>
                <FiLogIn size={18} />
                Login
              </>
            )}
          </button>
        </form>

        <div style={{ 
          marginTop: '30px', 
          paddingTop: '30px', 
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', marginBottom: '10px' }}>
            Don't have an account?
          </p>
          <button
            onClick={() => navigate('/profile')}
            style={{
              background: 'transparent',
              border: '2px solid white',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'white';
              e.target.style.color = '#f52929';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = 'white';
            }}
          >
            Create Profile
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Login;
