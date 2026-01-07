import { useState, useEffect, useRef } from 'react';
import { FiX, FiSearch, FiUser, FiFileText, FiHash } from 'react-icons/fi';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

function SearchModal({ isOpen, onClose, searchQuery }) {
  const [searchResults, setSearchResults] = useState({ posts: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'posts', 'users'
  const navigate = useNavigate();
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !searchQuery || searchQuery.trim().length < 2) {
      setSearchResults({ posts: [], users: [] });
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      const queryLower = searchQuery.toLowerCase().trim();

      try {
        // Search posts
        const postsQuery = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const postsSnapshot = await getDocs(postsQuery);
        
        const allPosts = postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter posts by content (case-insensitive)
        const filteredPosts = allPosts.filter(post => {
          const content = post.content?.toLowerCase() || '';
          const authorName = post.author?.name?.toLowerCase() || '';
          const category = post.category?.toLowerCase() || '';
          const channelName = post.channelName?.toLowerCase() || '';
          
          return content.includes(queryLower) || 
                 authorName.includes(queryLower) ||
                 category.includes(queryLower) ||
                 channelName.includes(queryLower);
        });

        // Search users
        const usersQuery = query(
          collection(db, 'users'),
          limit(100)
        );
        const usersSnapshot = await getDocs(usersQuery);
        
        const allUsers = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter users by name, username, or email
        const filteredUsers = allUsers.filter(user => {
          const name = user.name?.toLowerCase() || '';
          const username = user.username?.toLowerCase() || '';
          const email = user.email?.toLowerCase() || '';
          
          return name.includes(queryLower) || 
                 username.includes(queryLower) ||
                 email.includes(queryLower);
        });

        setSearchResults({
          posts: filteredPosts.slice(0, 10), // Limit to 10 posts
          users: filteredUsers.slice(0, 10) // Limit to 10 users
        });
      } catch (error) {
        console.error('Error performing search:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, isOpen]);

  const handlePostClick = (post) => {
    onClose();
    // Navigate to feed and scroll to post (or you could create a dedicated post view)
    navigate('/feed');
    // You could also store the post ID in state and highlight it
  };

  const handleUserClick = (user) => {
    onClose();
    // Navigate to feed with user filter
    navigate(`/feed?user=${user.id}`);
  };

  if (!isOpen) return null;

  const hasResults = searchResults.posts.length > 0 || searchResults.users.length > 0;
  const showResults = searchQuery && searchQuery.trim().length >= 2;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        ref={modalRef}
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '600px', 
          maxHeight: '80vh', 
          display: 'flex', 
          flexDirection: 'column',
          marginTop: '80px'
        }}
      >
        <div className="modal-header" style={{ 
          background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)', 
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
              <FiSearch size={22} />
            </div>
            <h2 className="modal-title" style={{ 
              color: 'white', 
              margin: 0, 
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.02em'
            }}>
              Search Results
            </h2>
          </div>
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
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <FiX size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
          {!showResults ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
              <FiSearch size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
              <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Start typing to search</p>
              <p style={{ fontSize: '14px' }}>Search for posts, users, or content</p>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
              <div style={{ fontSize: '16px' }}>Searching...</div>
            </div>
          ) : !hasResults ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
              <FiSearch size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
              <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No results found</p>
              <p style={{ fontSize: '14px' }}>Try different keywords or search terms</p>
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              {/* Tabs */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '20px',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '10px'
              }}>
                <button
                  onClick={() => setActiveTab('all')}
                  style={{
                    padding: '8px 16px',
                    background: activeTab === 'all' ? '#6b46c1' : 'transparent',
                    color: activeTab === 'all' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                >
                  All ({searchResults.posts.length + searchResults.users.length})
                </button>
                <button
                  onClick={() => setActiveTab('posts')}
                  style={{
                    padding: '8px 16px',
                    background: activeTab === 'posts' ? '#6b46c1' : 'transparent',
                    color: activeTab === 'posts' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                >
                  Posts ({searchResults.posts.length})
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  style={{
                    padding: '8px 16px',
                    background: activeTab === 'users' ? '#6b46c1' : 'transparent',
                    color: activeTab === 'users' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                >
                  Users ({searchResults.users.length})
                </button>
              </div>

              {/* Results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Posts Results */}
                {(activeTab === 'all' || activeTab === 'posts') && searchResults.posts.length > 0 && (
                  <div>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: '#6b7280', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '12px'
                    }}>
                      Posts
                    </div>
                    {searchResults.posts.map((post) => {
                      const timeAgo = post.createdAt?.toDate 
                        ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true })
                        : 'just now';
                      
                      return (
                        <div
                          key={post.id}
                          onClick={() => handlePostClick(post)}
                          style={{
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '15px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginBottom: '10px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#6b46c1';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 70, 193, 0.1)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              flexShrink: 0
                            }}>
                              <FiFileText size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                marginBottom: '6px'
                              }}>
                                <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>
                                  {post.author?.name || 'Unknown'}
                                </span>
                                {post.author?.isAdmin && (
                                  <span style={{
                                    background: '#6b46c1',
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 600
                                  }}>
                                    Admin
                                  </span>
                                )}
                                <span style={{ color: '#9ca3af', fontSize: '12px' }}>•</span>
                                <span style={{ color: '#9ca3af', fontSize: '12px' }}>{timeAgo}</span>
                              </div>
                              <div style={{ 
                                color: '#374151', 
                                fontSize: '14px',
                                lineHeight: '1.5',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                              }}>
                                {post.content?.replace(/<[^>]*>/g, '').substring(0, 150) || 'No content'}
                                {post.content?.length > 150 ? '...' : ''}
                              </div>
                              {post.channelName && (
                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FiHash size={12} style={{ color: '#9ca3af' }} />
                                  <span style={{ color: '#6b7280', fontSize: '12px' }}>
                                    {post.channelName}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Users Results */}
                {(activeTab === 'all' || activeTab === 'users') && searchResults.users.length > 0 && (
                  <div>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: '#6b7280', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '12px',
                      marginTop: activeTab === 'users' ? '0' : '20px'
                    }}>
                      Users
                    </div>
                    {searchResults.users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleUserClick(user)}
                        style={{
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          padding: '15px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          marginBottom: '10px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#6b46c1';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 70, 193, 0.1)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            flexShrink: 0
                          }}>
                            {user.name ? user.name.charAt(0).toUpperCase() : <FiUser size={20} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontWeight: 600, 
                              color: '#1f2937', 
                              fontSize: '15px',
                              marginBottom: '4px'
                            }}>
                              {user.name || 'Unknown User'}
                            </div>
                            <div style={{ 
                              color: '#6b7280', 
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {user.username && (
                                <span>@{user.username}</span>
                              )}
                              {user.email && (
                                <>
                                  <span>•</span>
                                  <span>{user.email}</span>
                                </>
                              )}
                            </div>
                            {user.isAdmin && (
                              <span style={{
                                background: '#6b46c1',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                display: 'inline-block',
                                marginTop: '6px'
                              }}>
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;

