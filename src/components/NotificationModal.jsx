import { useState, useEffect } from 'react';
import { FiX, FiBell, FiAtSign, FiMessageCircle } from 'react-icons/fi';
import { collection, query, onSnapshot, updateDoc, doc, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatDistanceToNow } from 'date-fns';

function NotificationModal({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    // Get user profile
    const savedProfile = localStorage.getItem('userProfile');
    const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    } else if (isAdminAuthenticated) {
      setUserProfile({ id: 'admin', name: 'IronLady', email: 'admin@ironlady.com', isAdmin: true });
    }

    if (!userProfile || !userProfile.id) {
      setLoading(false);
      return;
    }

    // Listen to notifications for this user in real-time
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userProfile.id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setNotifications(notificationsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen, userProfile]);

  const markAsRead = async (notificationId) => {
    if (!userProfile) return;
    
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userProfile) return;
    
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        return updateDoc(notificationRef, {
          read: true,
          readAt: new Date()
        });
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiBell size={20} />
            <h2 className="modal-title" style={{ color: 'white', margin: 0 }}>Notifications</h2>
            {unreadCount > 0 && (
              <span style={{
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                Mark all read
              </button>
            )}
            <button className="close-btn" onClick={onClose} style={{ color: 'white' }}>
              <FiX />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f9fafb' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '18px' }}>Loading notifications...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <FiBell size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
              <p>No notifications yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notifications.map((notification) => {
                const timeAgo = notification.createdAt
                  ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })
                  : 'just now';
                
                const isRead = notification.read;

                return (
                  <div
                    key={notification.id}
                    onClick={() => !isRead && markAsRead(notification.id)}
                    style={{
                      background: isRead ? 'white' : '#fef3c7',
                      border: `1px solid ${isRead ? '#e5e7eb' : '#fbbf24'}`,
                      borderRadius: '12px',
                      padding: '15px',
                      cursor: !isRead ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isRead) e.currentTarget.style.background = '#fde68a';
                    }}
                    onMouseLeave={(e) => {
                      if (!isRead) e.currentTarget.style.background = '#fef3c7';
                    }}
                  >
                    {!isRead && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        width: '10px',
                        height: '10px',
                        background: '#f59e0b',
                        borderRadius: '50%'
                      }}></div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: notification.type === 'mention' 
                          ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' 
                          : '#e0e7ff',
                        color: notification.type === 'mention' ? 'white' : '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {notification.type === 'mention' ? (
                          <FiAtSign size={20} />
                        ) : (
                          <FiMessageCircle size={20} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: isRead ? 600 : 700, 
                          color: '#1f2937', 
                          fontSize: '15px',
                          marginBottom: '4px'
                        }}>
                          {notification.title}
                        </div>
                        <div style={{ 
                          color: '#374151', 
                          fontSize: '14px', 
                          lineHeight: '1.5',
                          marginBottom: '6px'
                        }}>
                          {notification.message}
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          <span>{timeAgo}</span>
                          {notification.type === 'mention' && (
                            <>
                              <span>•</span>
                              <span style={{ 
                                background: '#fef3c7',
                                color: '#92400e',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                Tagged
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationModal;

