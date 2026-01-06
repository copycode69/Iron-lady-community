import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import HelpButton from './HelpButton';
import LiveBanner from './LiveBanner';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

function Layout({ children }) {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Listen to live status to adjust content margin
    const liveStatusRef = doc(db, 'system', 'liveStatus');
    const unsubscribe = onSnapshot(liveStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        setIsLive(snapshot.data().isLive || false);
      } else {
        setIsLive(false);
      }
    }, (error) => {
      console.error('Error listening to live status:', error);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <TopNav />
        <LiveBanner />
        <div className="content-area" style={{ marginTop: isLive ? '120px' : '70px' }}>
          {children}
        </div>
      </div>
      <HelpButton />
    </div>
  );
}

export default Layout;

