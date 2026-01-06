import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiSearch, FiBell, FiMessageCircle, FiBookmark, FiChevronDown, FiLogOut, FiUser, FiSettings } from 'react-icons/fi';
import MessageModal from './MessageModal';
import NotificationModal from './NotificationModal';
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase/config';

function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Get user profile from localStorage
    const loadProfile = () => {
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        try {
          setUserProfile(JSON.parse(savedProfile));
        } catch (error) {
          console.error('Error parsing profile:', error);
          setUserProfile(null); // Clear if error
        }
      } else {
        // No profile - show IronLady default
        setUserProfile(null);
      }
    };
    
    loadProfile();
    
    // Listen for storage changes (when profile is updated/removed)
    const handleStorageChange = (e) => {
      if (e.key === 'userProfile') {
        loadProfile();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event when localStorage is changed in same tab
    const handleCustomStorageChange = () => {
      loadProfile();
    };
    window.addEventListener('profileUpdated', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileUpdated', handleCustomStorageChange);
    };
  }, []);

  const getUserInitial = () => {
    // If no profile, show "I" for IronLady
    if (!userProfile) {
      return 'I';
    }
    if (userProfile?.name) {
      return userProfile.name.charAt(0).toUpperCase();
    }
    if (userProfile?.email) {
      return userProfile.email.charAt(0).toUpperCase();
    }
    return 'I'; // Default to "I" for IronLady
  };

  const getUserName = () => {
    return userProfile?.name || 'IronLady';
  };

  const getUserEmail = () => {
    return userProfile?.email || 'admin@ironlady.com';
  };

  const isUserAdmin = () => {
    const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    return userProfile?.isAdmin || userProfile?.isSuperAdmin || isAdminAuthenticated || false;
  };

  const isSuperAdmin = () => {
    if (!userProfile) return false;
    return userProfile.email === 'superadmin@gmail.com' || 
           userProfile.username === 'ironlady' ||
           userProfile.isSuperAdmin === true;
  };

  // Listen to unread messages count
  useEffect(() => {
    if (!userProfile && !sessionStorage.getItem('adminAuthenticated')) {
      setUnreadMessageCount(0);
      return;
    }

    const messagesQuery = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (userProfile) {
          const userId = userProfile.id || 'guest';
          const unread = messages.filter(msg => {
            return !msg.readBy || !msg.readBy.includes(userId);
          }).length;
          setUnreadMessageCount(unread);
        } else {
          // For admin without profile, show count of all messages
          setUnreadMessageCount(messages.length);
        }
      },
      (error) => {
        console.error('Error fetching messages:', error);
      }
    );

    return () => unsubscribe();
  }, [userProfile]);

  // Listen to unread notifications count
  useEffect(() => {
    if (!userProfile && !sessionStorage.getItem('adminAuthenticated')) {
      setUnreadNotificationCount(0);
      return;
    }

    const userId = userProfile?.id || 'guest';
    if (userId === 'guest' || userId === 'admin') {
      setUnreadNotificationCount(0);
      return;
    }

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        setUnreadNotificationCount(snapshot.size);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
      }
    );

    return () => unsubscribe();
  }, [userProfile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      // Clear all user data
      localStorage.removeItem('userProfile');
      sessionStorage.removeItem('adminAuthenticated');
      // Clear userProfile state
      setUserProfile(null);
      setDropdownOpen(false);
      // Dispatch custom event to update other components
      window.dispatchEvent(new Event('profileUpdated'));
      // Redirect to login page
      navigate('/');
    }
  };

  return (
    <div className="top-nav">
      <div className="nav-center">
        <Link to="/feed" className={`nav-link ${location.pathname === '/feed' ? 'active' : ''}`}>
          Home
        </Link>
        <Link to="/courses" className={`nav-link ${location.pathname === '/courses' ? 'active' : ''}`}>
          Courses
        </Link>
        <Link to="/events" className={`nav-link ${location.pathname === '/events' ? 'active' : ''}`}>
          Events
        </Link>
        <Link to="/members" className={`nav-link ${location.pathname === '/members' ? 'active' : ''}`}>
          Members
        </Link>
        <Link to="/leaderboard" className={`nav-link ${location.pathname === '/leaderboard' ? 'active' : ''}`}>
          Leaderboard
        </Link>
      </div>

      <div className="nav-right">
        <div className="search-bar">
          <FiSearch />
          <input type="text" placeholder="Search..." />
        </div>
        <div 
          className="nav-icon" 
          onClick={() => setIsNotificationModalOpen(true)}
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <FiBell />
          {unreadNotificationCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              border: '2px solid #f2dede'
            }}>
              {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
            </span>
          )}
        </div>
        <div 
          className="nav-icon" 
          onClick={() => setIsMessageModalOpen(true)}
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <FiMessageCircle />
          {unreadMessageCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              border: '2px solid #f2dede'
            }}>
              {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
            </span>
          )}
        </div>
        <Link 
          to="/saved" 
          className="nav-icon"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <FiBookmark />
        </Link>
        <div className="nav-avatar-dropdown" ref={dropdownRef}>
          <div 
            className="nav-avatar" 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
          >
            {!userProfile ? (
              <img 
                src="/logo.png" 
                alt="Iron Lady" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                  padding: '5px'
                }} 
              />
            ) : (
              getUserInitial()
            )}
          </div>
          {dropdownOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-header">
                <div className="dropdown-avatar" style={{ overflow: 'hidden' }}>
                  {!userProfile ? (
                    <img 
                      src="/logo.png" 
                      alt="Iron Lady" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        padding: '5px'
                      }} 
                    />
                  ) : (
                    getUserInitial()
                  )}
                </div>
                <div>
                  <div className="dropdown-name">{getUserName()}</div>
                  <div className="dropdown-email">{getUserEmail()}</div>
                </div>
              </div>
              <div className="dropdown-divider"></div>
              <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                <FiUser />
                <span>My Profile</span>
              </Link>
              {isSuperAdmin() && (
                <Link to="/admin" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <FiSettings />
                  <span>Admin Dashboard</span>
                </Link>
              )}
              <div className="dropdown-item" onClick={handleLogout}>
                <FiLogOut />
                <span>Sign Out</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <MessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        isAdmin={isUserAdmin()}
      />

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />
    </div>
  );
}

export default TopNav;
