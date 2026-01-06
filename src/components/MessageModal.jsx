import { useState, useEffect, useRef } from 'react';
import { FiX, FiSend, FiMessageCircle, FiAtSign, FiUser } from 'react-icons/fi';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatDistanceToNow } from 'date-fns';

function MessageModal({ isOpen, onClose, isAdmin }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Fetch all users for @mentions
  useEffect(() => {
    if (!isOpen || !isAdmin) return;

    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(user => user.username); // Only users with username
        setAllUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [isOpen, isAdmin]);

  useEffect(() => {
    if (!isOpen) return;

    // Get user profile
    const savedProfile = localStorage.getItem('userProfile');
    const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    } else if (isAdminAuthenticated) {
      setUserProfile({ name: 'IronLady', email: 'superadmin@gmail.com', username: 'ironlady', isAdmin: true, isSuperAdmin: true });
    }

    // Listen to messages in real-time
    const messagesQuery = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(messagesData.reverse()); // Reverse to show oldest first
      },
      (error) => {
        console.error('Error fetching messages:', error);
      }
    );

    return () => unsubscribe();
  }, [isOpen, isAdmin]);

  // Handle @mention detection and suggestions
  const handleMessageChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!isAdmin) return;

    // Find @ mentions in the text
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space after @ (meaning mention is complete)
      if (textAfterAt.includes(' ') || textAfterAt.length === 0) {
        setShowSuggestions(false);
        return;
      }

      const searchTerm = textAfterAt.toLowerCase();
      const filtered = allUsers.filter(user => 
        user.username && user.username.toLowerCase().startsWith(searchTerm)
      ).slice(0, 5); // Limit to 5 suggestions

      if (filtered.length > 0) {
        setMentionSuggestions(filtered);
        setMentionIndex(lastAtIndex);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (user) => {
    const textBefore = newMessage.substring(0, mentionIndex);
    const textAfter = newMessage.substring(mentionIndex + 1 + (newMessage.substring(mentionIndex + 1).match(/^[a-z0-9_]*/i)?.[0]?.length || 0));
    const newText = `${textBefore}@${user.username} ${textAfter}`;
    setNewMessage(newText);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => {
        const cursorPos = mentionIndex + user.username.length + 2;
        inputRef.current.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    }
  };

  // Parse mentions from message text
  const parseMentions = (text) => {
    if (!text) return { text, mentions: [] };
    const mentionRegex = /@([a-z0-9_]+)/gi;
    const mentions = [];
    let match;
    const mentionMap = new Map();

    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1].toLowerCase();
      if (!mentionMap.has(username)) {
        mentionMap.set(username, true);
        mentions.push(username);
      }
    }

    return { text, mentions };
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const savedProfile = localStorage.getItem('userProfile');
      const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
      
      let authorInfo = {
        id: 'admin',
        name: 'IronLady',
        email: 'superadmin@gmail.com',
        username: 'ironlady',
        isAdmin: true,
        isSuperAdmin: true
      };

      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          authorInfo = {
            id: profile.id || 'admin',
            name: profile.name || 'Admin',
            email: profile.email || 'superadmin@gmail.com',
            username: profile.username || null,
            isAdmin: profile.isAdmin || isAdminAuthenticated,
            isSuperAdmin: profile.isSuperAdmin || false
          };
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      } else if (isAdminAuthenticated) {
        authorInfo = {
          id: 'admin',
          name: 'IronLady',
          email: 'superadmin@gmail.com',
          username: 'ironlady',
          isAdmin: true,
          isSuperAdmin: true
        };
      }

      // Parse mentions
      const { mentions } = parseMentions(newMessage.trim());
      const taggedUsers = allUsers.filter(user => 
        user.username && mentions.includes(user.username.toLowerCase())
      ).map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email
      }));

      // Create message
      const messageRef = await addDoc(collection(db, 'messages'), {
        text: newMessage.trim(),
        author: authorInfo,
        taggedUsers: taggedUsers, // Store tagged users
        mentions: mentions, // Store mention usernames
        createdAt: serverTimestamp(),
        readBy: []
      });

      // Create notifications for tagged users
      if (taggedUsers.length > 0) {
        const notificationPromises = taggedUsers.map(taggedUser => {
          return addDoc(collection(db, 'notifications'), {
            userId: taggedUser.id,
            type: 'mention',
            title: `You were mentioned by ${authorInfo.name || 'Admin'}`,
            message: `You were tagged in a message: "${newMessage.trim().substring(0, 100)}${newMessage.trim().length > 100 ? '...' : ''}"`,
            relatedMessageId: messageRef.id,
            author: authorInfo,
            read: false,
            createdAt: serverTimestamp()
          });
        });
        
        await Promise.all(notificationPromises);
      }

      setNewMessage('');
      setShowSuggestions(false);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (messageId) => {
    if (!userProfile) return;
    
    try {
      const messageRef = doc(db, 'messages', messageId);
      const userId = userProfile.id || 'guest';
      
      // Check if already read
      const message = messages.find(m => m.id === messageId);
      if (message && message.readBy && message.readBy.includes(userId)) {
        return; // Already read
      }

      await updateDoc(messageRef, {
        readBy: [...(message?.readBy || []), userId]
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  if (!isOpen) return null;

  const unreadCount = messages.filter(msg => {
    if (!userProfile) return false;
    const userId = userProfile.id || 'guest';
    return !msg.readBy || !msg.readBy.includes(userId);
  }).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiMessageCircle size={20} />
            <h2 className="modal-title" style={{ color: 'white', margin: 0 }}>Messages</h2>
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
          <button className="close-btn" onClick={onClose} style={{ color: 'white' }}>
            <FiX />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f9fafb' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <FiMessageCircle size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
              <p>No messages yet.</p>
              {isAdmin && <p style={{ fontSize: '14px', marginTop: '10px' }}>Send a message to all users!</p>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {messages.map((message) => {
                const timeAgo = message.createdAt
                  ? formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })
                  : 'just now';
                
                const isRead = userProfile && message.readBy && message.readBy.includes(userProfile.id || 'guest');
                const isFromAdmin = message.author?.isAdmin;

                return (
                  <div
                    key={message.id}
                    onClick={() => !isRead && markAsRead(message.id)}
                    style={{
                      background: isRead ? 'white' : '#e0e7ff',
                      border: `1px solid ${isRead ? '#e5e7eb' : '#c7d2fe'}`,
                      borderRadius: '12px',
                      padding: '15px',
                      cursor: !isRead ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isRead) e.currentTarget.style.background = '#dbeafe';
                    }}
                    onMouseLeave={(e) => {
                      if (!isRead) e.currentTarget.style.background = '#e0e7ff';
                    }}
                  >
                    {!isRead && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        width: '10px',
                        height: '10px',
                        background: '#4f46e5',
                        borderRadius: '50%'
                      }}></div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: isFromAdmin ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : '#e0e7ff',
                        color: isFromAdmin ? 'white' : '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        flexShrink: 0
                      }}>
                        {message.author?.name ? message.author.name[0].toUpperCase() : 'A'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '15px' }}>
                            {message.author?.name || 'Admin'}
                          </span>
                          {isFromAdmin && (
                            <span style={{
                              background: '#4f46e5',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 600
                            }}>
                              Admin
                            </span>
                          )}
                          <span style={{ color: '#6b7280', fontSize: '12px' }}>• {timeAgo}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ color: '#374151', fontSize: '14px', lineHeight: '1.6', marginLeft: '46px' }}>
                      {message.text && message.text.split(/(@[a-z0-9_]+)/gi).map((part, idx) => {
                        if (part.startsWith('@')) {
                          const username = part.substring(1).toLowerCase();
                          const isTagged = message.taggedUsers?.some(u => u.username?.toLowerCase() === username);
                          return (
                            <span
                              key={idx}
                              style={{
                                color: isTagged ? '#4f46e5' : '#6b7280',
                                fontWeight: isTagged ? 600 : 400,
                                background: isTagged ? '#e0e7ff' : 'transparent',
                                padding: isTagged ? '2px 4px' : '0',
                                borderRadius: isTagged ? '4px' : '0'
                              }}
                            >
                              {part}
                            </span>
                          );
                        }
                        return <span key={idx}>{part}</span>;
                      })}
                    </div>
                    {message.taggedUsers && message.taggedUsers.length > 0 && (
                      <div style={{ marginTop: '10px', marginLeft: '46px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>Tagged:</span>
                        {message.taggedUsers.map((user, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: '#e0e7ff',
                              color: '#4f46e5',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            @{user.username}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin && (
          <div style={{ padding: '20px', background: 'white', borderTop: '1px solid #e5e7eb', position: 'relative' }}>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', position: 'relative' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={handleMessageChange}
                  onKeyDown={(e) => {
                    if (showSuggestions && mentionSuggestions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        // Handle arrow navigation if needed
                      } else if (e.key === 'Enter' && mentionSuggestions.length > 0) {
                        e.preventDefault();
                        insertMention(mentionSuggestions[0]);
                      } else if (e.key === 'Escape') {
                        setShowSuggestions(false);
                      }
                    }
                  }}
                  placeholder="Type a message... Use @username to tag users"
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  disabled={sending}
                />
                {showSuggestions && mentionSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      marginBottom: '5px',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}
                  >
                    {mentionSuggestions.map((user, idx) => (
                      <div
                        key={user.id}
                        onClick={() => insertMention(user)}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          borderBottom: idx < mentionSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white';
                        }}
                      >
                        <FiUser size={16} style={{ color: '#6b46c1' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>
                            @{user.username}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {user.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!newMessage.trim() || sending}
                style={{
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FiSend size={18} />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', marginLeft: '0' }}>
              <FiAtSign size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Type @username to tag users in your message
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageModal;

