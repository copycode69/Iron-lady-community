import { useState, useEffect } from 'react';
import { FiX, FiBell, FiAtSign, FiMessageCircle, FiHeart, FiUser, FiTrash2, FiCheck } from 'react-icons/fi';
import { collection, query, onSnapshot, updateDoc, deleteDoc, doc, orderBy, limit, where, writeBatch } from 'firebase/firestore';
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
      setUserProfile({ id: 'admin', name: 'IronLady', email: 'superadmin@gmail.com', username: 'ironlady', isAdmin: true, isSuperAdmin: true });
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

  const clearAllNotifications = async () => {
    if (!userProfile) return;
    
    if (!window.confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Use batch write for better performance
      const batch = writeBatch(db);
      const batchLimit = 500; // Firestore batch limit
      
      notifications.slice(0, batchLimit).forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.delete(notificationRef);
      });
      
      await batch.commit();
      
      // If there are more than 500 notifications, delete the rest
      if (notifications.length > batchLimit) {
        const remainingNotifications = notifications.slice(batchLimit);
        for (const notification of remainingNotifications) {
          try {
            await deleteDoc(doc(db, 'notifications', notification.id));
          } catch (error) {
            console.error('Error deleting notification:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      alert('Error clearing notifications. Please try again.');
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ 
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', 
          color: 'white',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <FiBell size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <h2 className="modal-title" style={{ 
                color: 'white', 
                margin: 0, 
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '-0.02em'
              }}>
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'inline-block',
                  marginTop: '2px'
                }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                title="Clear all notifications"
              >
                <FiTrash2 size={14} />
                Clear Chat
              </button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                title="Mark all as read"
              >
                <FiCheck size={14} />
                Mark as Read
              </button>
            )}
            <button 
              className="close-btn" 
              onClick={onClose} 
              style={{ 
                color: 'white',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginLeft: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'rotate(0deg)';
              }}
            >
              <FiX size={18} />
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
                          : notification.type === 'welcome'
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : notification.type === 'like'
                          ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                          : notification.type === 'comment'
                          ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                          : '#e0e7ff',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {notification.type === 'mention' ? (
                          <FiAtSign size={20} />
                        ) : notification.type === 'welcome' ? (
                          <FiUser size={20} />
                        ) : notification.type === 'like' ? (
                          <FiHeart size={20} />
                        ) : notification.type === 'comment' ? (
                          <FiMessageCircle size={20} />
                        ) : (
                          <FiBell size={20} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: isRead ? 600 : 700, 
                          color: '#1f2937', 
                          fontSize: '15px',
                          marginBottom: '4px'
                        }}>
                          {notification.title || 
                            (notification.type === 'welcome' ? 'Welcome!' :
                             notification.type === 'like' ? 'New Like' :
                             notification.type === 'comment' ? 'New Comment' :
                             notification.type === 'mention' ? 'You were mentioned' :
                             'Notification')}
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
                          {notification.type === 'welcome' && (
                            <>
                              <span>•</span>
                              <span style={{ 
                                background: '#d1fae5',
                                color: '#065f46',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                Welcome
                              </span>
                            </>
                          )}
                          {notification.type === 'like' && (
                            <>
                              <span>•</span>
                              <span style={{ 
                                background: '#fee2e2',
                                color: '#991b1b',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                Like
                              </span>
                            </>
                          )}
                          {notification.type === 'comment' && (
                            <>
                              <span>•</span>
                              <span style={{ 
                                background: '#dbeafe',
                                color: '#1e40af',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                Comment
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

