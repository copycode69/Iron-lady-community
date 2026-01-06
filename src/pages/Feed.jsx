import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, limit, startAfter, getDocs, doc, updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import { FiPlus, FiChevronDown } from 'react-icons/fi';

function Feed() {
  console.log('Feed - Component rendered');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedChannelId = searchParams.get('channel') || null;
  const [posts, setPosts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastPost, setLastPost] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortBy, setSortBy] = useState('latest');
  const [selectedChannelName, setSelectedChannelName] = useState(null);
  const POSTS_PER_PAGE = 20;
  
  console.log('Feed - Current state:', {
    postsCount: posts.length,
    loading,
    isAdmin,
    userProfile: userProfile ? { name: userProfile.name, state: userProfile.state } : null,
    selectedChannelId
  });

  useEffect(() => {
    // Get user profile from localStorage
    const loadProfile = () => {
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          setUserProfile(profile);
          const isUserAdmin = profile.isAdmin || profile.isSuperAdmin || 
                             profile.email === 'superadmin@gmail.com' || 
                             profile.username === 'ironlady';
          setIsAdmin(isUserAdmin);
          console.log('Feed - Profile loaded:', {
            name: profile.name,
            email: profile.email,
            username: profile.username,
            state: profile.state,
            isAdmin: profile.isAdmin,
            isSuperAdmin: profile.isSuperAdmin,
            calculatedIsAdmin: isUserAdmin
          });
        } catch (error) {
          console.error('Error parsing user profile:', error);
          setIsAdmin(false);
        }
      } else {
        // No profile - not admin
        setIsAdmin(false);
        console.log('Feed - No profile found in localStorage');
      }
    };

    // Load profile initially
    loadProfile();

    // Listen for profile updates
    const handleProfileUpdate = () => {
      loadProfile();
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const loadPosts = useCallback(async (isInitial = false) => {
    console.log('Feed - loadPosts called, isInitial:', isInitial);
    try {
      if (isInitial) {
        setLoading(true);
        console.log('Feed - Setting loading to true');
      } else {
        setLoadingMore(true);
      }

      // Get user's state for filtering
      const savedProfile = localStorage.getItem('userProfile');
      const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
      console.log('Feed - Saved profile exists:', !!savedProfile, 'Admin authenticated:', isAdminAuthenticated);
      let userStateId = null;
      let isUserAdmin = false;
      const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          userStateId = profile.state;
          // Check if user is admin or superadmin
          // Only superadmin@gmail.com with username ironlady is superadmin
          isUserAdmin = profile.isAdmin || 
                       profile.isSuperAdmin || 
                       (profile.email === SUPERADMIN_EMAIL && profile.username === 'ironlady') ||
                       profile.username === 'ironlady' ||
                       isAdminAuthenticated;
          console.log('Feed - User profile:', {
            email: profile.email,
            username: profile.username,
            isAdmin: profile.isAdmin,
            isSuperAdmin: profile.isSuperAdmin,
            isUserAdmin: isUserAdmin,
            isAdminAuthenticated: isAdminAuthenticated,
            state: userStateId
          });
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      } else if (isAdminAuthenticated) {
        // Admin authenticated via password but no profile
        isUserAdmin = true;
        console.log('Feed - Admin authenticated via sessionStorage, no profile');
      } else {
        // No profile and not admin authenticated - not admin
        isUserAdmin = false;
        console.log('Feed - No profile found and not admin authenticated');
      }

      let q;
      let snapshot;
      // For admins, get more posts since they see all posts
      const queryLimit = isUserAdmin ? POSTS_PER_PAGE * 5 : POSTS_PER_PAGE * 2;
      
      console.log('Feed - Attempting to query Firestore...');
      console.log('Feed - Query parameters:', { sortBy, queryLimit, isInitial, hasLastPost: !!lastPost });
      
      try {
        // First, try a simple query without ordering to test connectivity
        const testQuery = query(collection(db, 'posts'), limit(1));
        const testSnapshot = await getDocs(testQuery);
        console.log('Feed - Firestore connection test successful, posts collection exists');
        
        if (sortBy === 'popular') {
          q = query(
            collection(db, 'posts'),
            orderBy('likes', 'desc'),
            orderBy('createdAt', 'desc'),
            limit(queryLimit)
          );
        } else if (sortBy === 'oldest') {
          q = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'asc'),
            limit(queryLimit)
          );
        } else {
          // Latest
          q = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            limit(queryLimit)
          );
        }

        // If loading more, start after last post
        if (!isInitial && lastPost) {
          q = query(q, startAfter(lastPost));
        }

        snapshot = await getDocs(q);
        console.log('Feed - Ordered query successful, fetched:', snapshot.docs.length, 'documents');
      } catch (queryError) {
        console.error('Error with ordered query, trying fallback:', queryError);
        console.error('Query error details:', {
          code: queryError.code,
          message: queryError.message,
          stack: queryError.stack
        });
        // Fallback: Get all posts without ordering (in case createdAt field is missing or index issue)
        try {
          const fallbackQuery = query(
            collection(db, 'posts'),
            limit(queryLimit * 2) // Get more to account for filtering
          );
          snapshot = await getDocs(fallbackQuery);
          console.log('Fallback query successful, fetched:', snapshot.docs.length, 'posts');
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          console.error('Fallback error details:', {
            code: fallbackError.code,
            message: fallbackError.message
          });
          throw fallbackError;
        }
      }
      let postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // If we used fallback query (no ordering), sort manually
      if (postsData.length > 0 && (!postsData[0].createdAt || !postsData[0].createdAt.toDate)) {
        // Fallback query was used, sort manually
        if (sortBy === 'popular') {
          postsData.sort((a, b) => {
            const likesA = a.likes || 0;
            const likesB = b.likes || 0;
            if (likesB !== likesA) return likesB - likesA;
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateB - dateA;
          });
        } else if (sortBy === 'oldest') {
          postsData.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateA - dateB;
          });
        } else {
          // Latest - default
          postsData.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateB - dateA;
          });
        }
      }

      console.log('Feed - Total posts fetched from Firestore:', postsData.length);
      console.log('Feed - Sample post data:', postsData.length > 0 ? {
        id: postsData[0].id,
        stateId: postsData[0].stateId,
        channelId: postsData[0].channelId,
        isAnnouncement: postsData[0].isAnnouncement,
        hasContent: !!postsData[0].content,
        createdAt: postsData[0].createdAt
      } : 'No posts');

      // Filter out announcements from regular posts (they're shown separately)
      postsData = postsData.filter(post => !post.isAnnouncement);
      
      console.log('Feed - Posts after removing announcements:', postsData.length);
      console.log('Feed - Admin check: isUserAdmin =', isUserAdmin, 'userStateId =', userStateId, 'email =', savedProfile ? JSON.parse(savedProfile).email : 'no profile');
      
      // STRICT FILTERING: Regular users only see posts from their state
      if (!isUserAdmin) {
        if (userStateId) {
          // User has a state - only show posts from that state
          postsData = postsData.filter(post => {
            // Post must have a stateId and it must match user's state
            return post.stateId && post.stateId === userStateId;
          });
          console.log(`Filtered posts for state: ${userStateId}, showing ${postsData.length} posts`);
          
          // CHANNEL FILTERING: If a channel is selected, filter by channel too
          if (selectedChannelId) {
            postsData = postsData.filter(post => {
              // Post must have a channelId and it must match selected channel
              return post.channelId && post.channelId === selectedChannelId;
            });
            console.log(`Filtered posts for channel: ${selectedChannelId}, showing ${postsData.length} posts`);
          }
        } else {
          // User has no state assigned - show NO posts (they need to set their state first)
          console.log('User has no state assigned - showing no posts');
          postsData = [];
        }
      } else {
        // ADMIN: See ALL posts from ALL states (no state filtering)
        // Only filter by channel if selected, but show posts from all states
        if (selectedChannelId) {
          postsData = postsData.filter(post => {
            return post.channelId && post.channelId === selectedChannelId;
          });
          console.log(`Admin filtered posts for channel: ${selectedChannelId}, showing ${postsData.length} posts from all states`);
        } else {
          console.log('Admin user - showing ALL posts from ALL states:', postsData.length);
        }
      }
      
      // For admins, show more posts since they see all states
      // For regular users, limit to POSTS_PER_PAGE after filtering
      if (!isUserAdmin) {
        postsData = postsData.slice(0, POSTS_PER_PAGE);
      } else {
        // Admins can see more posts (3x limit)
        postsData = postsData.slice(0, POSTS_PER_PAGE * 3);
      }
      
      console.log('Feed - Loaded posts:', postsData.length, 'isAdmin:', isUserAdmin, 'userState:', userStateId);
      console.log('Feed - Setting posts state with', postsData.length, 'posts');

      if (isInitial) {
        setPosts(postsData);
        console.log('Feed - Initial posts set:', postsData.length);
      } else {
        setPosts(prev => {
          const newPosts = [...prev, ...postsData];
          console.log('Feed - Appended posts, total:', newPosts.length);
          return newPosts;
        });
      }

      // Update pagination state
      if (snapshot.docs.length < POSTS_PER_PAGE) {
        setHasMore(false);
      } else {
        setLastPost(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(true);
      }

      setLoading(false);
      setLoadingMore(false);
      console.log('Feed - loadPosts completed successfully, loading set to false');
      console.log('Feed - loadPosts completed successfully');
    } catch (error) {
      console.error('Error loading posts:', error);
      console.error('Error details:', error.message, error.code, error.stack);
      setLoading(false);
      setLoadingMore(false);
      
      // Check if it's a Firestore index error
      if (error.code === 'failed-precondition') {
        console.error('Firestore index error - check console for index link');
        alert('Firestore index required. Please check the browser console for the index link.');
      } else if (error.code === 'permission-denied') {
        console.error('Firestore permission denied - check security rules');
        alert('Permission denied. Please check Firestore security rules.');
      } else {
        console.error('Unknown error:', error);
        alert(`Error loading posts: ${error.message || 'Please check your connection and try again.'}`);
      }
    }
  }, [sortBy, lastPost, selectedChannelId]);

  // Fetch channel name when channel ID changes
  useEffect(() => {
    if (selectedChannelId) {
      const fetchChannelName = async () => {
        try {
          const channelsQuery = query(collection(db, 'channels'));
          const snapshot = await getDocs(channelsQuery);
          const channel = snapshot.docs.find(doc => doc.id === selectedChannelId);
          if (channel) {
            setSelectedChannelName(channel.data().name);
          } else {
            setSelectedChannelName(null);
          }
        } catch (error) {
          console.error('Error fetching channel name:', error);
          setSelectedChannelName(null);
        }
      };
      fetchChannelName();
    } else {
      setSelectedChannelName(null);
    }
  }, [selectedChannelId]);

  useEffect(() => {
    // Load initial posts
    console.log('Feed - useEffect triggered, loading posts...', { sortBy, selectedChannelId });
    setLastPost(null);
    setHasMore(true);
    setPosts([]);
    setLoading(true); // Ensure loading is true
    
    // Call loadPosts directly
    const loadInitialPosts = async () => {
      try {
        console.log('Feed - Starting to load posts...');
        await loadPosts(true);
        console.log('Feed - Posts loaded successfully');
      } catch (error) {
        console.error('Feed - Error in loadPosts:', error);
        setLoading(false);
        setLoadingMore(false);
      }
    };
    
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Feed - Loading timeout, setting loading to false');
        setLoading(false);
      }
    }, 30000); // 30 second timeout
    
    loadInitialPosts();
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [sortBy, selectedChannelId, loadPosts]);

  // Fetch announcements separately (always visible at top)
  useEffect(() => {
    const announcementsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50) // Limit to improve performance
    );
    
    const unsubscribe = onSnapshot(
      announcementsQuery, 
      (snapshot) => {
        const allPosts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Filter announcements (show latest 5)
        const announcementPosts = allPosts
          .filter(post => post.isAnnouncement === true)
          .slice(0, 5);
        
        setAnnouncements(announcementPosts);
      },
      (error) => {
        console.error('Error fetching announcements:', error);
        // Don't show alert for announcements, just log
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time listener for new posts (only latest 5 for performance)
  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Get user's state for filtering
      const savedProfile = localStorage.getItem('userProfile');
      const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
      let userStateId = null;
      let isUserAdmin = false;
      const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          userStateId = profile.state;
          isUserAdmin = profile.isAdmin || 
                       profile.isSuperAdmin || 
                       (profile.email === SUPERADMIN_EMAIL && profile.username === 'ironlady') ||
                       profile.username === 'ironlady' ||
                       isAdminAuthenticated;
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      } else if (isAdminAuthenticated) {
        // Admin authenticated via password
        isUserAdmin = true;
      } else {
        isUserAdmin = false; // No profile and not admin authenticated - not admin
      }
      
      // Only update if we're on latest sort and at the top
      if (sortBy === 'latest' && posts.length > 0) {
        // Check if there are truly new posts (excluding announcements)
        const existingIds = new Set(posts.map(p => p.id));
        let actuallyNew = newPosts.filter(p => !existingIds.has(p.id) && !p.isAnnouncement);
        
        // STRICT FILTERING: Regular users only see posts from their state
        if (!isUserAdmin) {
          if (userStateId) {
            // User has a state - only show posts from that state
            actuallyNew = actuallyNew.filter(post => post.stateId && post.stateId === userStateId);
            
            // CHANNEL FILTERING: If a channel is selected, filter by channel too
            if (selectedChannelId) {
              actuallyNew = actuallyNew.filter(post => post.channelId && post.channelId === selectedChannelId);
            }
          } else {
            // User has no state - don't show any new posts
            actuallyNew = [];
          }
        } else {
          // Admins see all posts, but can filter by channel if selected
          if (selectedChannelId) {
            actuallyNew = actuallyNew.filter(post => post.channelId && post.channelId === selectedChannelId);
          }
        }
        
        if (actuallyNew.length > 0) {
          setPosts(prev => [...actuallyNew, ...prev]);
        }
      }
    });

    return () => unsubscribe();
  }, [sortBy, posts.length, selectedChannelId]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadPosts(false);
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setLastPost(null);
    setHasMore(true);
    setPosts([]);
  };

  const handleLike = async (postId, isLiked) => {
    try {
      const postRef = doc(db, 'posts', postId);
      const userId = userProfile?.id || 'guest';
      
      if (isLiked) {
        await updateDoc(postRef, {
          likes: increment(1),
          likedBy: arrayUnion(userId)
        });
      } else {
        await updateDoc(postRef, {
          likes: increment(-1),
          likedBy: arrayRemove(userId)
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
      alert('Error updating like. Please try again.');
    }
  };

  const handleComment = async (postId) => {
    const commentText = prompt('Enter your comment:');
    if (commentText && commentText.trim()) {
      try {
        const postRef = doc(db, 'posts', postId);
        const userId = userProfile?.id || 'guest';
        const userName = userProfile?.name || 'Guest';
        
        await updateDoc(postRef, {
          comments: increment(1)
        });

        await addDoc(collection(db, 'posts', postId, 'comments'), {
          text: commentText.trim(),
          author: {
            id: userId,
            name: userName,
            email: userProfile?.email || ''
          },
          createdAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error adding comment:', error);
        alert('Error adding comment. Please try again.');
      }
    }
  };

  return (
    <div>
      <div className="feed-header">
        <h1 className="feed-title">
          Feed
          {selectedChannelName && (
            <span style={{ fontSize: '18px', fontWeight: 400, color: '#6b7280', marginLeft: '10px' }}>
              - {selectedChannelName}
            </span>
          )}
        </h1>
        <div className="feed-controls">
          {selectedChannelId && (
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setSearchParams({});
                setSelectedChannelName(null);
              }}
              style={{ marginRight: '10px', fontSize: '14px', padding: '8px 16px' }}
            >
              Show All Channels
            </button>
          )}
          <select 
            className="sort-dropdown" 
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            <option value="latest">Latest</option>
            <option value="popular">Popular</option>
            <option value="oldest">Oldest</option>
          </select>
          <button className="new-post-btn" onClick={() => setIsModalOpen(true)}>
            New post
          </button>
        </div>
      </div>

      <div className="create-post-box" onClick={() => setIsModalOpen(true)}>
        <div className="create-post-input">
          <div className="create-post-text">Start a post</div>
          <FiPlus style={{ marginLeft: 'auto', color: '#6b46c1' }} />
        </div>
      </div>

      {/* Announcements Section */}
      {announcements.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            marginBottom: '15px',
            padding: '12px',
            background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
            borderRadius: '12px',
            color: 'white'
          }}>
            <span style={{ fontSize: '24px' }}>📢</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Announcements</h2>
          </div>
          {announcements.map((announcement) => (
            <div 
              key={announcement.id}
              style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '15px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start', gap: '15px', marginBottom: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: '#6b46c1',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  📢
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '16px' }}>
                      {announcement.author?.name || 'Admin'}
                    </span>
                    <span style={{
                      background: '#6b46c1',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      ADMIN
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>
                      {announcement.createdAt?.toDate ? 
                        new Date(announcement.createdAt.toDate()).toLocaleDateString() : 
                        'Recently'}
                    </span>
                  </div>
                  <div style={{ color: '#374151', fontSize: '14px', lineHeight: '1.6' }}>
                    {announcement.content}
                  </div>
                  {(announcement.imageUrl || announcement.imageBase64) && (
                    <img 
                      src={announcement.imageUrl || announcement.imageBase64} 
                      alt="Announcement" 
                      style={{
                        width: '100%',
                        maxHeight: '400px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginTop: '15px'
                      }}
                      loading="lazy"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '10px' }}>Loading posts...</div>
          <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '10px' }}>Please wait while we fetch your feed</div>
          <div style={{ fontSize: '12px', color: '#d1d5db' }}>
            Debug: loading={loading.toString()}, posts={posts.length}, isAdmin={isAdmin.toString()}
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>No posts yet</div>
          <div style={{ fontSize: '14px', marginBottom: '20px' }}>
            {isAdmin ? (
              'There are no posts in the community yet. Create the first post!'
            ) : userProfile?.state ? (
              `No posts in your state (${userProfile.state}) yet. Be the first to post!`
            ) : (
              'You need to set your state in your profile to see posts. Please update your profile.'
            )}
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsModalOpen(true)}
            style={{ marginTop: '10px' }}
          >
            Create First Post
          </button>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onComment={handleComment}
              userId={userProfile?.id || 'guest'}
              userProfile={userProfile}
              isAdmin={isAdmin}
            />
          ))}
          
          {hasMore && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <button 
                className="btn btn-primary"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More Posts'}
              </button>
            </div>
          )}
          
          {!hasMore && posts.length > 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
              No more posts to load
            </div>
          )}
        </>
      )}

      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

export default Feed;
