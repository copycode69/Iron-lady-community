import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMonitor, FiCamera, FiBook, FiCalendar } from 'react-icons/fi';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

function Sidebar() {
  const location = useLocation();
  const [states, setStates] = useState([]);
  const [channels, setChannels] = useState([]);
  const [userState, setUserState] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Function to check if user is admin
    const checkAdminStatus = () => {
      const savedProfile = localStorage.getItem('userProfile');
      const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
      const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
      
      // If admin authenticated via password, treat as admin
      if (isAdminAuthenticated) {
        setUserState(null);
        setIsAdmin(true);
        return { isAdmin: true, state: null };
      }
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          // Only superadmin@gmail.com with username ironlady is superadmin
          const isUserAdmin = profile.isAdmin || profile.isSuperAdmin || 
                             (profile.email === SUPERADMIN_EMAIL && profile.username === 'ironlady') ||
                             profile.username === 'ironlady';
          setUserState(profile.state);
          setIsAdmin(isUserAdmin);
          return { isAdmin: isUserAdmin, state: profile.state };
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      }
      // No profile and not admin authenticated
      setUserState(null);
      setIsAdmin(false);
      return { isAdmin: false, state: null };
    };

    // Initial check
    const adminStatus = checkAdminStatus();
    
    // Listen for storage changes (when profile is updated)
    const handleStorageChange = () => {
      checkAdminStatus();
    };
    window.addEventListener('storage', handleStorageChange);

    // Only fetch states and channels if user has a profile OR is admin authenticated
    const savedProfile = localStorage.getItem('userProfile');
    const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    
    if (!savedProfile && !isAdminAuthenticated) {
      // No profile and not admin - don't fetch states/channels
      setStates([]);
      setChannels([]);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }

    // Fetch states
    const statesQuery = query(collection(db, 'states'));
    const statesUnsubscribe = onSnapshot(
      statesQuery, 
      (snapshot) => {
        const statesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Check if profile still exists OR admin is authenticated
        const profileCheck = localStorage.getItem('userProfile');
        const adminCheck = sessionStorage.getItem('adminAuthenticated') === 'true';
        if (!profileCheck && !adminCheck) {
          setStates([]);
          return;
        }
        
        // Re-check admin status in case profile changed
        const currentAdminStatus = checkAdminStatus();
        
        // If admin is authenticated via password, treat as admin
        if (adminCheck && !currentAdminStatus.isAdmin) {
          currentAdminStatus.isAdmin = true;
        }
        
        console.log('Sidebar - States fetched:', statesData.length);
        console.log('Sidebar - isAdmin:', currentAdminStatus.isAdmin, 'userState:', currentAdminStatus.state);
        
        // Filter states: admins see all, regular users see only their state
        if (currentAdminStatus.isAdmin) {
          setStates(statesData);
        } else if (currentAdminStatus.state) {
          setStates(statesData.filter(s => s.id === currentAdminStatus.state));
        } else {
          setStates([]);
        }
      },
      (error) => {
        console.error('Sidebar - Error fetching states:', error);
        console.error('Error details:', error.message, error.code);
      }
    );

    // Fetch channels
    const channelsQuery = query(collection(db, 'channels'));
    const channelsUnsubscribe = onSnapshot(
      channelsQuery, 
      (snapshot) => {
        const channelsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Check if profile still exists OR admin is authenticated
        const profileCheck = localStorage.getItem('userProfile');
        const adminCheck = sessionStorage.getItem('adminAuthenticated') === 'true';
        if (!profileCheck && !adminCheck) {
          setChannels([]);
          return;
        }
        
        // Re-check admin status in case profile changed
        const currentAdminStatus = checkAdminStatus();
        
        // If admin is authenticated via password, treat as admin
        if (adminCheck) {
          currentAdminStatus.isAdmin = true;
        }
        
        console.log('Sidebar - Channels fetched:', channelsData.length);
        console.log('Sidebar - Filtering channels, isAdmin:', currentAdminStatus.isAdmin);
        
        // Filter channels: admins see all, regular users see only their state's channels
        if (currentAdminStatus.isAdmin) {
          setChannels(channelsData);
          console.log('Sidebar - Setting all channels for admin:', channelsData.length);
        } else if (currentAdminStatus.state) {
          const filtered = channelsData.filter(ch => ch.stateId === currentAdminStatus.state);
          setChannels(filtered);
          console.log('Sidebar - Filtered channels for user state:', filtered.length);
        } else {
          setChannels([]);
        }
      },
      (error) => {
        console.error('Sidebar - Error fetching channels:', error);
        console.error('Error details:', error.message, error.code);
      }
    );

    // Listen to live status if admin
    let liveUnsubscribe = null;
    const currentAdminStatus = checkAdminStatus();
    if (currentAdminStatus.isAdmin || isAdminAuthenticated) {
      const liveStatusRef = doc(db, 'system', 'liveStatus');
      liveUnsubscribe = onSnapshot(liveStatusRef, (snapshot) => {
        if (snapshot.exists()) {
          setIsLive(snapshot.data().isLive || false);
        } else {
          setIsLive(false);
        }
      }, (error) => {
        console.error('Error listening to live status:', error);
      });
    }

    return () => {
      statesUnsubscribe();
      channelsUnsubscribe();
      if (liveUnsubscribe) liveUnsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []); // Run once, but check admin status inside callbacks

  const handleGoLive = async () => {
    try {
      const liveStatusRef = doc(db, 'system', 'liveStatus');
      const liveDoc = await getDoc(liveStatusRef);
      
      // Get admin name
      const savedProfile = localStorage.getItem('userProfile');
      const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
      let adminName = 'Admin';
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          adminName = profile.name || 'Admin';
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      } else if (isAdminAuthenticated) {
        adminName = 'IronLady';
      }

      if (liveDoc.exists() && liveDoc.data().isLive) {
        // Stop live
        if (window.confirm('Are you sure you want to stop the live session?')) {
          await updateDoc(liveStatusRef, {
            isLive: false,
            stoppedAt: new Date()
          });
          alert('Live session stopped!');
        }
      } else {
        // Start live
        const message = prompt('Enter a message for your live session (optional):');
        await setDoc(liveStatusRef, {
          isLive: true,
          adminName: adminName,
          message: message || '',
          startedAt: new Date(),
          stoppedAt: null
        }, { merge: true });
        alert('You are now live! All users will see this notification.');
      }
    } catch (error) {
      console.error('Error toggling live status:', error);
      alert('Error toggling live status. Please try again.');
    }
  };

  const getChannelsByState = (stateId) => {
    return channels.filter(ch => ch.stateId === stateId);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Iron Lady Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div className="sidebar-brand-name">
          <div>Ironlady</div>
          <div className="sidebar-brand-subtitle">Community</div>
        </div>
      </div>

      <div className="sidebar-nav">
        <Link
          to="/feed"
          className={`sidebar-nav-item ${location.pathname === '/feed' ? 'active' : ''}`}
        >
          <FiMonitor />
          <span>Feed</span>
        </Link>
        <Link
          to="/courses"
          className={`sidebar-nav-item ${location.pathname === '/courses' ? 'active' : ''}`}
        >
          <FiBook />
          <span>Courses</span>
        </Link>
        <Link
          to="/events"
          className={`sidebar-nav-item ${location.pathname === '/events' ? 'active' : ''}`}
        >
          <FiCalendar />
          <span>Events</span>
        </Link>
      </div>

      {!localStorage.getItem('userProfile') && sessionStorage.getItem('adminAuthenticated') !== 'true' ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '10px', fontWeight: 600 }}>Please create your profile to access states and channels</div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>Go to the profile page to get started</div>
        </div>
      ) : states.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
          No states yet. Add states from Admin panel.
        </div>
      ) : (
        states.map((state) => {
          const stateChannels = getChannelsByState(state.id);
          
          return (
            <div key={state.id} className="categories-section">
              <div className="category-city">
                <div className="city-name">
                  <span className="city-name-icon">📍</span>
                  {state.name}
                </div>
                <div className="channels-list">
                  {stateChannels.length > 0 ? (
                    stateChannels.map((channel) => (
                      <Link
                        key={channel.id}
                        to={`/feed?channel=${channel.id}`}
                        className="category-item"
                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <div className="category-dot"></div>
                        <span className="channel-name">{channel.name}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="no-channels-message">
                      No channels yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {isAdmin && (
        <div className="spaces-section">
          <div className="spaces-heading">Spaces</div>
          <button 
            className="go-live-btn"
            onClick={handleGoLive}
            style={{
              background: isLive ? '#ef4444' : 'rgba(255, 255, 255, 0.15)',
              borderColor: isLive ? '#dc2626' : 'rgba(255, 255, 255, 0.2)'
            }}
          >
            <FiCamera />
            <span>{isLive ? 'Stop Live' : 'Go live'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
