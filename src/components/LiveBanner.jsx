import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiRadio, FiX } from 'react-icons/fi';

function LiveBanner() {
  const [isLive, setIsLive] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if current user is admin
    const savedProfile = localStorage.getItem('userProfile');
    const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    const SUPERADMIN_EMAIL = 'admin@ironlady.com';
    // Removed default guest admin email
    
    let userIsAdmin = false;
    if (isAdminAuthenticated) {
      userIsAdmin = true;
    } else if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        userIsAdmin = profile.isAdmin || 
                     profile.isSuperAdmin || 
                     profile.email === SUPERADMIN_EMAIL ||
                     profile.email === DEFAULT_ADMIN_EMAIL;
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    }
    setIsAdmin(userIsAdmin);

    // Listen to live status in Firestore
    const liveStatusRef = doc(db, 'system', 'liveStatus');
    const unsubscribe = onSnapshot(liveStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsLive(data.isLive || false);
        setLiveData(data);
      } else {
        setIsLive(false);
        setLiveData(null);
      }
    }, (error) => {
      console.error('Error listening to live status:', error);
    });

    return () => unsubscribe();
  }, []);

  const handleStopLive = async () => {
    if (window.confirm('Are you sure you want to stop the live session?')) {
      try {
        const liveStatusRef = doc(db, 'system', 'liveStatus');
        await updateDoc(liveStatusRef, {
          isLive: false,
          stoppedAt: new Date()
        });
      } catch (error) {
        console.error('Error stopping live session:', error);
        alert('Error stopping live session. Please try again.');
      }
    }
  };

  if (!isLive || !liveData) return null;

  return (
    <div className="live-banner">
      <div className="live-banner-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="live-indicator" style={{ position: 'relative' }}>
            <FiRadio style={{ fontSize: '18px', position: 'relative', zIndex: 1 }} />
            <span className="live-pulse"></span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'white' }}>
              🔴 {liveData.adminName || 'Admin'} is Live!
            </div>
            {liveData.message && (
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', marginTop: '2px' }}>
                {liveData.message}
              </div>
            )}
          </div>
        </div>
        {isAdmin && (
          <button 
            onClick={handleStopLive}
            className="stop-live-btn"
            title="Stop Live Session"
          >
            <FiX size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export default LiveBanner;

