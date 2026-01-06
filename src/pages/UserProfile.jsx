import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiUser, FiMail, FiMapPin, FiCheckCircle, FiAtSign } from 'react-icons/fi';

function UserProfile({ user }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    state: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState([]);

  useEffect(() => {
    // Set loading to false immediately so form shows
    setLoading(false);

    // Fetch states
    try {
      const statesQuery = query(collection(db, 'states'));
      const statesUnsubscribe = onSnapshot(
        statesQuery, 
        (snapshot) => {
          const statesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setStates(statesData);
        },
        (error) => {
          console.error('Error fetching states:', error);
          setLoading(false);
        }
      );

      // Don't auto-fill form - keep it clean for new profile creation
      // Only check if user wants to edit (they can click "Edit Profile" from welcome screen)
      // For now, always start with empty form

      return () => {
        statesUnsubscribe();
      };
    } catch (error) {
      console.error('Error initializing:', error);
      setLoading(false);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if this is the super admin email - if so, ensure it's super admin
    const isSuperAdminEmail = formData.email.toLowerCase().trim() === 'superadmin@gmail.com';
    const isSuperAdminUsername = formData.username.toLowerCase().trim() === 'ironlady';
    
    // Super admin must have both email and username correct
    if (isSuperAdminEmail && !isSuperAdminUsername) {
      alert('The email superadmin@gmail.com can only be used with username "ironlady".');
      return;
    }
    
    if (!formData.name || !formData.email || !formData.username || !formData.state) {
      // Super admin doesn't need a state
      if (!isSuperAdminEmail || formData.state) {
        alert('Please fill in all fields including username');
        return;
      }
    }

    // Validate username format (alphanumeric and underscore only, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(formData.username)) {
      alert('Username must be 3-20 characters and contain only letters, numbers, and underscores');
      return;
    }

    try {
      let savedUserData;
      const isSuperAdmin = isSuperAdminEmail && isSuperAdminUsername;
      
      if (userData && userData.id) {
        // Check if username is already taken by another user
        const usernameCheck = query(collection(db, 'users'), where('username', '==', formData.username));
        const usernameSnapshot = await getDocs(usernameCheck);
        const usernameTaken = usernameSnapshot.docs.some(doc => doc.id !== userData.id);
        
        if (usernameTaken && !isSuperAdmin) {
          alert('Username is already taken. Please choose a different username.');
          return;
        }

        // Update existing user - ensure super admin status
        const updateData = {
          name: formData.name,
          email: formData.email,
          username: formData.username.toLowerCase(),
          state: isSuperAdmin ? null : formData.state,
          updatedAt: new Date()
        };
        
        // Force super admin status if it's the super admin account
        if (isSuperAdmin) {
          updateData.isAdmin = true;
          updateData.isSuperAdmin = true;
        }
        
        await updateDoc(doc(db, 'users', userData.id), updateData);
        savedUserData = { 
          ...userData, 
          ...formData, 
          username: formData.username.toLowerCase(),
          state: isSuperAdmin ? null : formData.state,
          isAdmin: isSuperAdmin ? true : (userData.isAdmin || false),
          isSuperAdmin: isSuperAdmin ? true : (userData.isSuperAdmin || false)
        };
      } else {
        // Check if username is already taken
        const usernameCheck = query(collection(db, 'users'), where('username', '==', formData.username.toLowerCase()));
        const usernameSnapshot = await getDocs(usernameCheck);
        
        if (!usernameSnapshot.empty && !isSuperAdmin) {
          alert('Username is already taken. Please choose a different username.');
          return;
        }

        // Check if super admin email already exists
        if (isSuperAdminEmail) {
          const emailCheck = query(collection(db, 'users'), where('email', '==', 'superadmin@gmail.com'));
          const emailSnapshot = await getDocs(emailCheck);
          
          if (!emailSnapshot.empty) {
            // Update existing super admin account
            await updateDoc(doc(db, 'users', emailSnapshot.docs[0].id), {
              name: formData.name,
              email: formData.email,
              username: formData.username.toLowerCase(),
              state: null,
              isAdmin: true,
              isSuperAdmin: true,
              updatedAt: new Date()
            });
            savedUserData = { 
              id: emailSnapshot.docs[0].id, 
              ...formData, 
              username: formData.username.toLowerCase(),
              state: null,
              isAdmin: true,
              isSuperAdmin: true
            };
          } else {
            // Create new super admin
            const docRef = await addDoc(collection(db, 'users'), {
              name: formData.name,
              email: formData.email,
              username: formData.username.toLowerCase(),
              state: null,
              isAdmin: true,
              isSuperAdmin: true,
              createdAt: new Date()
            });
            savedUserData = { 
              id: docRef.id, 
              ...formData, 
              username: formData.username.toLowerCase(),
              state: null,
              isAdmin: true,
              isSuperAdmin: true
            };
          }
        } else {
          // Create new regular user
          const docRef = await addDoc(collection(db, 'users'), {
            name: formData.name,
            email: formData.email,
            username: formData.username.toLowerCase(),
            state: formData.state,
            isAdmin: false,
            isSuperAdmin: false,
            createdAt: new Date()
          });
          savedUserData = { 
            id: docRef.id, 
            ...formData, 
            username: formData.username.toLowerCase(),
            isAdmin: false,
            isSuperAdmin: false
          };
        }
      }
      
      // Save to localStorage
      localStorage.setItem('userProfile', JSON.stringify(savedUserData));
      setUserData(savedUserData);
      
      // Dispatch custom event to update other components
      window.dispatchEvent(new Event('profileUpdated'));
      
      // If user already had a profile (editing), redirect to profile view
      // Otherwise show welcome screen
      if (userData && userData.id) {
        // User was editing - redirect to profile view
        navigate('/my-profile');
      } else {
        // New user - show welcome screen
        setIsSubmitted(true);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    }
  };

  // Always show form first, don't wait for loading
  if (isSubmitted && userData) {
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
          maxWidth: '600px', 
          width: '100%',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          padding: '40px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
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
          </div>
          <FiCheckCircle style={{ fontSize: '64px', color: '#10b981', marginBottom: '20px' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', marginBottom: '10px' }}>
            Welcome, {userData.name}!
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '30px', fontSize: '18px' }}>
            Your profile has been successfully created.
          </p>

          <div style={{ 
            background: '#f9fafb', 
            borderRadius: '12px', 
            padding: '30px', 
            marginTop: '30px',
            textAlign: 'left',
            maxWidth: '500px',
            margin: '30px auto 0',
            border: '1px solid #e5e7eb'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1f2937', marginBottom: '20px' }}>
              Your Profile Information
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <FiUser style={{ color: '#6b46c1', fontSize: '20px' }} />
                <span style={{ fontWeight: 600, color: '#374151' }}>Name:</span>
              </div>
              <div style={{ color: '#6b7280', marginLeft: '30px' }}>{userData.name}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <FiMail style={{ color: '#6b46c1', fontSize: '20px' }} />
                <span style={{ fontWeight: 600, color: '#374151' }}>Email:</span>
              </div>
              <div style={{ color: '#6b7280', marginLeft: '30px' }}>{userData.email}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <FiAtSign style={{ color: '#6b46c1', fontSize: '20px' }} />
                <span style={{ fontWeight: 600, color: '#374151' }}>Username:</span>
              </div>
              <div style={{ color: '#6b7280', marginLeft: '30px' }}>@{userData.username || 'Not set'}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <FiMapPin style={{ color: '#6b46c1', fontSize: '20px' }} />
                <span style={{ fontWeight: 600, color: '#374151' }}>State:</span>
              </div>
              <div style={{ color: '#6b7280', marginLeft: '30px' }}>
                {states.find(s => s.id === userData.state)?.name || userData.state}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  // Pre-fill form with existing data when editing
                  setFormData({
                    name: userData.name || '',
                    email: userData.email || '',
                    username: userData.username || '',
                    state: userData.state || ''
                  });
                  setIsSubmitted(false);
                }}
                style={{ flex: 1 }}
              >
                Edit Profile
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => window.location.href = '/login'}
                style={{ flex: 1 }}
              >
                Login Now
              </button>
            </div>
          </div>

          <div style={{ marginTop: '40px', padding: '20px', background: '#eff6ff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '10px' }}>
              What's Next?
            </h3>
            <ul style={{ textAlign: 'left', color: '#374151', lineHeight: '1.8', maxWidth: '500px', margin: '0 auto' }}>
              <li>Explore the Feed to see community posts</li>
              <li>Join Events and Courses</li>
              <li>Connect with other Members</li>
              <li>Check your ranking on the Leaderboard</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

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
        maxWidth: '500px', 
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
            {userData ? 'Update Your Profile' : 'Create Your Profile'}
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px' }}>
            {userData ? 'Update your information below' : 'Please provide your information to get started'}
          </p>
        </div>

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
              Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your full name"
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontSize: '15px',
                background: 'white',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'white'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 600, 
              color: 'white',
              fontSize: '14px'
            }}>
              <FiMail style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
              Email Address *
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
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontSize: '15px',
                background: 'white',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'white'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 600, 
              color: 'white',
              fontSize: '14px'
            }}>
              <FiAtSign style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
              Username *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="Enter username (e.g., johndoe)"
              pattern="[a-zA-Z0-9_]{3,20}"
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontSize: '15px',
                background: 'white',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'white'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'}
            />
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', marginTop: '5px' }}>
              3-20 characters, letters, numbers, and underscores only. This will be used for @mentions.
            </p>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 600, 
              color: 'white',
              fontSize: '14px'
            }}>
              <FiMapPin style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
              Select Your State *
            </label>
            <select
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontSize: '15px',
                background: 'white',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'white'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'}
            >
              <option value="">Choose your state...</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
            {states.length === 0 && (
              <p style={{ color: '#fef3c7', fontSize: '12px', marginTop: '5px' }}>
                No states available yet. You can still create your profile and add states later from Admin panel.
              </p>
            )}
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              background: 'white',
              color: '#f52929',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {userData ? 'Update Profile' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default UserProfile;
