import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import CreatePostModal from '../components/CreatePostModal';
import { FiPlus, FiUser, FiMail, FiMapPin, FiLogOut, FiEdit, FiBook, FiCalendar } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

function UserDashboard({ user }) {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [userState, setUserState] = useState(null);
  const [userChannels, setUserChannels] = useState([]);
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalEvents: 0,
    totalCourses: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Get user profile from localStorage
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      let profile;
      try {
        profile = JSON.parse(savedProfile);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error parsing profile:', error);
        setLoading(false);
        return;
      }
      
      // Check if user is admin
      const userIsAdmin = profile.isAdmin || profile.isSuperAdmin || 
                         profile.email === 'superadmin@gmail.com' || 
                         profile.username === 'ironlady' ||
                         profile.email === 'admin@ironlady.com';
      setIsUserAdmin(userIsAdmin);
      
      // Fetch all states (needed for admin to show state names for channels)
      const statesQuery = query(collection(db, 'states'));
      const statesUnsubscribe = onSnapshot(statesQuery, (snapshot) => {
        const statesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllStates(statesData);
        
        // Set user's state if they have one
        if (profile.state) {
          const userStateData = statesData.find(s => s.id === profile.state);
          setUserState(userStateData);
        }
      });
      
      // Fetch channels - admins see all channels, regular users see only their state's channels
      const channelsQuery = query(collection(db, 'channels'));
      const channelsUnsubscribe = onSnapshot(channelsQuery, (snapshot) => {
        const channelsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // If admin, show all channels; otherwise filter by user's state
        const userChannelsData = userIsAdmin 
          ? channelsData 
          : channelsData.filter(ch => ch.stateId === profile.state);
        setUserChannels(userChannelsData);
      });
      
      setLoading(false);
      
      return () => {
        statesUnsubscribe();
        channelsUnsubscribe();
      };
    } else {
      // No profile, redirect to login
      navigate('/');
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!userProfile) return;

    // Fetch user's posts - filter by email since that's what we store
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50) // Get more to filter client-side
    );
    
    const postsUnsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Filter posts by user's email or uid
      const userPostsData = allPosts.filter(post => 
        post.author?.email === userProfile.email || 
        post.author?.uid === userProfile.id
      ).slice(0, 10);
      setUserPosts(userPostsData);
      setStats(prev => ({ ...prev, totalPosts: userPostsData.length }));
    });

    // Fetch user's events
    const eventsQuery = query(
      collection(db, 'events'),
      where('createdBy.email', '==', userProfile.email),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const eventsUnsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, totalEvents: snapshot.size }));
    });

    // Fetch user's courses
    const coursesQuery = query(
      collection(db, 'courses'),
      where('createdBy.email', '==', userProfile.email),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const coursesUnsubscribe = onSnapshot(coursesQuery, (snapshot) => {
      setStats(prev => ({ ...prev, totalCourses: snapshot.size }));
    });

    return () => {
      postsUnsubscribe();
      eventsUnsubscribe();
      coursesUnsubscribe();
    };
  }, [userProfile]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      localStorage.removeItem('userProfile');
      sessionStorage.removeItem('adminAuthenticated');
      navigate('/');
    }
  };

  const getUserInitial = () => {
    if (userProfile?.name) {
      return userProfile.name.charAt(0).toUpperCase();
    }
    if (userProfile?.email) {
      return userProfile.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  if (loading) {
    return <div className="admin-container">Loading...</div>;
  }

  if (!userProfile) {
    return (
      <div className="admin-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ color: '#6b7280' }}>Please complete your profile first</h2>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
            Go to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-title">My Dashboard</h1>
          <p style={{ color: '#6b7280' }}>Welcome back, {userProfile.name}!</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}>
            {getUserInitial()}
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiLogOut />
            Sign Out
          </button>
        </div>
      </div>

      {/* User Stats */}
      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.totalPosts}</div>
          <div className="stat-label">My Posts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalEvents}</div>
          <div className="stat-label">My Events</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalCourses}</div>
          <div className="stat-label">My Courses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{userChannels.length}</div>
          <div className="stat-label">My Channels</div>
        </div>
      </div>

      {/* User Profile Info */}
      <div className="admin-section">
        <h2 className="section-title">My Profile</h2>
        <div className="stat-card" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                {getUserInitial()}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '18px', marginBottom: '5px' }}>
                  {userProfile.name}
                </div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                  {userProfile.email}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#374151' }}>
                <FiMapPin style={{ color: '#6b46c1' }} />
                <span><strong>State:</strong> {userState?.name || userProfile.state || 'Not set'}</span>
              </div>
              {userProfile.isAdmin && (
                <div style={{
                  display: 'inline-block',
                  background: '#10b981',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  width: 'fit-content'
                }}>
                  Admin
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiEdit />
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* My Channels */}
      <div className="admin-section">
        <h2 className="section-title">
          {isUserAdmin ? 'All Channels' : `My Channels (${userState?.name || 'Not set'})`}
        </h2>
        {userChannels.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
            {isUserAdmin 
              ? 'No channels available yet.' 
              : 'No channels available in your state yet.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
            {userChannels.map((channel) => {
              // For admins, find the state name for each channel
              let channelStateName = 'Unknown State';
              if (isUserAdmin) {
                const channelState = allStates.find(s => s.id === channel.stateId);
                channelStateName = channelState?.name || channel.stateId || 'Unknown State';
              } else {
                channelStateName = userState?.name || 'Unknown';
              }
              
              return (
                <div key={channel.id} className="stat-card" style={{ padding: '15px' }}>
                  <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '5px' }}>
                    {channel.name}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '14px' }}>
                    {channelStateName}
                  </div>
                  {isUserAdmin && (
                    <div style={{ 
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#6b46c1',
                      fontWeight: 600
                    }}>
                      Admin View - All Channels
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="admin-section">
        <h2 className="section-title">Quick Actions</h2>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setIsPostModalOpen(true)}>
            <FiPlus style={{ marginRight: '8px' }} />
            Create Post
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/events')}>
            <FiCalendar style={{ marginRight: '8px' }} />
            Create Event
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/courses')}>
            <FiBook style={{ marginRight: '8px' }} />
            Create Course
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/feed')}>
            View Feed
          </button>
        </div>
      </div>

      {/* My Recent Posts */}
      <div className="admin-section">
        <h2 className="section-title">My Recent Posts</h2>
        {userPosts.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
            You haven't created any posts yet. Create your first post!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {userPosts.map((post) => (
              <div key={post.id} className="stat-card" style={{ padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '5px' }}>
                      {post.stateName} - {post.channelName}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '14px' }}>
                      {post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleString() : 'Recently'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', color: '#6b7280', fontSize: '14px' }}>
                    <span>❤️ {post.likes || 0}</span>
                    <span>💬 {post.comments || 0}</span>
                  </div>
                </div>
                <div style={{ color: '#374151', lineHeight: '1.6' }}>
                  {post.content?.substring(0, 200)}{post.content?.length > 200 ? '...' : ''}
                </div>
                {post.isAnnouncement && (
                  <div style={{
                    display: 'inline-block',
                    background: '#fef3c7',
                    color: '#92400e',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    marginTop: '10px'
                  }}>
                    📢 Announcement
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        user={user}
      />
    </div>
  );
}

export default UserDashboard;

