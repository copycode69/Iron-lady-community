import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import PostCard from '../components/PostCard';
import { FiBookmark } from 'react-icons/fi';

function SavedPosts({ user }) {
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Get user profile from localStorage
    const savedProfile = localStorage.getItem('userProfile');
    const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    
    let userId = 'guest';
    let profile = null;
    
    if (savedProfile) {
      try {
        profile = JSON.parse(savedProfile);
        setUserProfile(profile);
        setIsAdmin(profile.isAdmin || profile.isSuperAdmin || 
                   (profile.email === 'superadmin@gmail.com' && profile.username === 'ironlady') ||
                   profile.username === 'ironlady');
        // Get userId - must match how PostCard stores bookmarks (userProfile?.id || user?.uid || 'guest')
        userId = profile.id || user?.uid || 'guest';
      } catch (error) {
        console.error('Error parsing user profile:', error);
      }
    } else if (isAdminAuthenticated) {
      profile = { id: 'admin', name: 'IronLady', email: 'superadmin@gmail.com', username: 'ironlady', isAdmin: true, isSuperAdmin: true };
      setUserProfile(profile);
      setIsAdmin(true);
      userId = user?.uid || 'admin';
    }

    if (!savedProfile && !isAdminAuthenticated) {
      setLoading(false);
      return;
    }

    if (!userId || userId === 'guest' || userId === 'admin') {
      setLoading(false);
      return;
    }

    // Listen to all posts in real-time and filter bookmarked ones
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const allPosts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter posts that are bookmarked by this specific user only
        const bookmarked = allPosts.filter(post => {
          // Check if user has bookmarked this post - must match exact userId
          if (post.bookmarkedBy && Array.isArray(post.bookmarkedBy)) {
            return post.bookmarkedBy.includes(userId);
          }
          return false;
        });

        // Exclude announcements from saved posts
        const saved = bookmarked.filter(post => !post.isAnnouncement);
        
        setSavedPosts(saved);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching saved posts:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleLike = async (postId, isLiked) => {
    try {
      const { doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove } = await import('firebase/firestore');
      const postRef = doc(db, 'posts', postId);
      const userId = userProfile?.id || user?.uid || 'guest';
      
      // Get post data to find author
      const postDoc = await getDoc(postRef);
      const postData = postDoc.data();
      const postAuthorId = postData?.author?.id || postData?.author?.uid;
      
      if (isLiked) {
        await updateDoc(postRef, {
          likes: increment(1),
          likedBy: arrayUnion(userId)
        });
        
        // Create notification for post author when someone likes their post
        if (postAuthorId && userId !== 'guest') {
          try {
            const { createLikeNotification } = await import('../utils/notifications');
            const likerName = userProfile?.name || user?.displayName || 'Someone';
            await createLikeNotification(postAuthorId, likerName, postId, postData?.content);
          } catch (error) {
            console.error('Error creating like notification:', error);
            // Don't block like action if notification fails
          }
        }
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
    // This will be handled by PostCard's CommentModal
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading saved posts...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="feed-header">
        <h1 className="feed-title">
          <FiBookmark style={{ marginRight: '10px', color: '#6b46c1' }} />
          Saved Posts
        </h1>
      </div>

      {!userProfile || !userProfile.id || userProfile.id === 'guest' || userProfile.id === 'admin' ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: 'white',
          borderRadius: '12px',
          border: '2px solid #e5e7eb'
        }}>
          <FiBookmark style={{ fontSize: '64px', color: '#d1d5db', marginBottom: '20px' }} />
          <h3 style={{ color: '#1f2937', marginBottom: '10px', fontSize: '24px', fontWeight: 700 }}>
            Please Login to View Saved Posts
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '16px' }}>
            You need to be logged in to see your saved posts.
          </p>
        </div>
      ) : savedPosts.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: 'white',
          borderRadius: '12px',
          border: '2px solid #e5e7eb'
        }}>
          <FiBookmark style={{ fontSize: '64px', color: '#d1d5db', marginBottom: '20px' }} />
          <h3 style={{ color: '#1f2937', marginBottom: '10px', fontSize: '24px', fontWeight: 700 }}>
            No Saved Posts Yet
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '16px' }}>
            Posts you bookmark will appear here in your personal space.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>
            Click the bookmark icon on any post to save it for later.
          </p>
        </div>
      ) : (
        <>
          <div style={{ 
            marginTop: '20px', 
            padding: '15px',
            background: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)',
            borderRadius: '12px',
            border: '1px solid #c7d2fe'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: '#1f2937', marginBottom: '5px', fontSize: '18px', fontWeight: 700 }}>
                  Your Saved Posts
                </h3>
                <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                  {savedPosts.length} {savedPosts.length === 1 ? 'post' : 'posts'} saved in your personal space
                </p>
              </div>
              <div style={{
                background: 'white',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <FiBookmark size={24} style={{ color: '#6b46c1' }} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            {savedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onComment={handleComment}
                userId={userProfile.id}
                userProfile={userProfile}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default SavedPosts;

