import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiUser, FiMail, FiMapPin, FiAtSign, FiEdit, FiLogOut } from 'react-icons/fi';

function ProfileView() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [states, setStates] = useState([]);
  const [userState, setUserState] = useState(null);
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalComments: 0,
    totalBookmarks: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user profile from localStorage
    const savedProfile = localStorage.getItem('userProfile');
    if (!savedProfile) {
      // No profile - redirect to create profile
      navigate('/profile');
      return;
    }

    try {
      const profile = JSON.parse(savedProfile);
      setUserProfile(profile);

      // Fetch states to get state name
      const statesQuery = query(collection(db, 'states'));
      getDocs(statesQuery).then((snapshot) => {
        const statesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStates(statesData);
        
        if (profile.state) {
          const stateData = statesData.find(s => s.id === profile.state);
          setUserState(stateData);
        }
      });

      // Fetch user stats
      const fetchStats = async () => {
        try {
          // Count user's posts
          const postsQuery = query(
            collection(db, 'posts'),
            where('authorId', '==', profile.id),
            orderBy('createdAt', 'desc')
          );
          const postsSnapshot = await getDocs(postsQuery);
          const postsCount = postsSnapshot.size;

          // Count user's bookmarks (posts where user is in bookmarkedBy array)
          const allPostsQuery = query(collection(db, 'posts'));
          const allPostsSnapshot = await getDocs(allPostsQuery);
          let bookmarksCount = 0;
          allPostsSnapshot.docs.forEach(doc => {
            const postData = doc.data();
            if (postData.bookmarkedBy && Array.isArray(postData.bookmarkedBy)) {
              if (postData.bookmarkedBy.includes(profile.id)) {
                bookmarksCount++;
              }
            }
          });

          setStats({
            totalPosts: postsCount,
            totalComments: 0, // Can be calculated if needed
            totalBookmarks: bookmarksCount
          });
        } catch (error) {
          console.error('Error fetching stats:', error);
        }
      };

      fetchStats();
      setLoading(false);
    } catch (error) {
      console.error('Error parsing profile:', error);
      navigate('/profile');
    }
  }, [navigate]);

  const handleEditProfile = () => {
    navigate('/profile');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      localStorage.removeItem('userProfile');
      sessionStorage.removeItem('adminAuthenticated');
      window.dispatchEvent(new Event('profileUpdated'));
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading profile...</div>
      </div>
    );
  }

  if (!userProfile) {
    return null; // Will redirect
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Profile Header */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '30px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '40px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(107, 70, 193, 0.3)'
            }}>
              {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                {userProfile.name || 'User'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', marginBottom: '4px' }}>
                <FiAtSign />
                <span style={{ fontSize: '16px' }}>@{userProfile.username || 'username'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
                <FiMail style={{ fontSize: '14px' }} />
                <span style={{ fontSize: '14px' }}>{userProfile.email}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleEditProfile}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 500,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#2563eb'}
              onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
            >
              <FiEdit />
              Edit Profile
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 20px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 500,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#dc2626'}
              onMouseLeave={(e) => e.target.style.background = '#ef4444'}
            >
              <FiLogOut />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#3b82f6', marginBottom: '8px' }}>
            {stats.totalPosts}
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Posts</div>
        </div>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>
            {stats.totalBookmarks}
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Saved Posts</div>
        </div>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#f59e0b', marginBottom: '8px' }}>
            {stats.totalComments}
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Comments</div>
        </div>
      </div>

      {/* Profile Information */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '20px' }}>
          Profile Information
        </h2>
        
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b46c1'
            }}>
              <FiUser style={{ fontSize: '24px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Full Name</div>
              <div style={{ fontSize: '16px', fontWeight: 500, color: '#1f2937' }}>
                {userProfile.name || 'Not set'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b46c1'
            }}>
              <FiMail style={{ fontSize: '24px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email Address</div>
              <div style={{ fontSize: '16px', fontWeight: 500, color: '#1f2937' }}>
                {userProfile.email || 'Not set'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b46c1'
            }}>
              <FiAtSign style={{ fontSize: '24px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Username</div>
              <div style={{ fontSize: '16px', fontWeight: 500, color: '#1f2937' }}>
                @{userProfile.username || 'Not set'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b46c1'
            }}>
              <FiMapPin style={{ fontSize: '24px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>State</div>
              <div style={{ fontSize: '16px', fontWeight: 500, color: '#1f2937' }}>
                {userState ? userState.name : (userProfile.state || 'Not set')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileView;

