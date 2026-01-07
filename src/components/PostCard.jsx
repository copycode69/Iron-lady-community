import { useState, useEffect } from 'react';
import { FiHeart, FiMessageCircle, FiBookmark, FiMoreVertical, FiShare2, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/config';
import CommentModal from './CommentModal';
import EditPostModal from './EditPostModal';

function PostCard({ post, onLike, onComment, userId, userProfile, isAdmin }) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    // Check if user has liked this post
    if (post.likedBy && userId) {
      setLiked(post.likedBy.includes(userId));
    }
    
    // Check if user has bookmarked this post
    if (post.bookmarkedBy && userId) {
      setBookmarked(post.bookmarkedBy.includes(userId));
    }
  }, [post, userId]);

  const handleLike = () => {
    const newLikedState = !liked;
    setLiked(newLikedState);
    if (onLike) onLike(post.id, newLikedState);
  };

  const handleBookmark = async () => {
    const newBookmarkState = !bookmarked;
    try {
      const postRef = doc(db, 'posts', post.id);
      if (newBookmarkState) {
        // Add bookmark
        await updateDoc(postRef, {
          bookmarkedBy: arrayUnion(userId || 'guest')
        });
        setBookmarked(true);
      } else {
        // Remove bookmark
        await updateDoc(postRef, {
          bookmarkedBy: arrayRemove(userId || 'guest')
        });
        setBookmarked(false);
      }
    } catch (error) {
      console.error('Error updating bookmark:', error);
      alert('Error updating bookmark. Please try again.');
    }
  };

  const timeAgo = post.createdAt
    ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true })
    : 'just now';

  // Use imageUrl from Firebase Storage, or fallback to imageBase64 from Firestore
  const imageSource = post.imageUrl || post.imageBase64 || null;

  return (
    <div className="post-card">
      {imageSource && (
        <img 
          src={imageSource} 
          alt="Post" 
          className="post-image" 
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}
      <div className="post-header">
        <div className="post-info">
          <div className="post-author">
            {post.author?.name || 'IronLady'}
            {post.author?.isAdmin && <span className="admin-badge">Admin</span>}
          </div>
          <div className="post-meta">
            {post.stateName && post.channelName ? (
              <>Posted in <strong>{post.stateName}</strong> → <strong>{post.channelName}</strong> • {timeAgo}</>
            ) : (
              <>Posted in {post.category || 'Health & Wellness'} • {timeAgo}</>
            )}
          </div>
        </div>
        <div className="nav-icon" style={{ position: 'relative' }}>
          <FiMoreVertical 
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              const menu = document.getElementById(`post-menu-${post.id}`);
              if (menu) {
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
              }
            }}
          />
          {((isAdmin || post.author?.id === userId || post.author?.uid === userId) && (
            <div 
              id={`post-menu-${post.id}`}
              style={{
                display: 'none',
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                minWidth: '120px',
                marginTop: '5px'
              }}
            >
              {(post.author?.id === userId || post.author?.uid === userId) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditModalOpen(true);
                    const menu = document.getElementById(`post-menu-${post.id}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#4f46e5',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: '1px solid #e5e7eb'
                  }}
                >
                  <FiEdit2 size={16} />
                  Edit
                </button>
              )}
              <button
                  onClick={async (e) => {
                  e.stopPropagation();
                  const confirmMsg = post.author?.isAdmin 
                    ? 'Are you sure you want to delete this admin post?'
                    : 'Are you sure you want to delete this post?';
                  if (window.confirm(confirmMsg)) {
                    try {
                      await deleteDoc(doc(db, 'posts', post.id));
                      alert('Post deleted successfully!');
                      // Reload page to refresh feed
                      window.location.reload();
                    } catch (error) {
                      console.error('Error deleting post:', error);
                      alert(`Error deleting post: ${error.message || 'Please try again.'}`);
                    }
                  }
                  const menu = document.getElementById(`post-menu-${post.id}`);
                  if (menu) menu.style.display = 'none';
                }}
                style={{
                  width: '100%',
                  padding: '10px 15px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#ef4444',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FiTrash2 size={16} />
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
      <div 
        className="post-content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
      <div className="post-actions">
        <div className="post-action" onClick={handleLike}>
          <FiHeart className="post-action-icon" style={{ color: liked ? '#ef4444' : '' }} />
          <span>{post.likes || 0}</span>
        </div>
        <div className="post-action" onClick={() => setIsCommentModalOpen(true)}>
          <FiMessageCircle className="post-action-icon" />
          <span>{post.comments || 0} comments</span>
        </div>
        <div className="post-action" onClick={handleBookmark}>
          <FiBookmark className="post-action-icon" style={{ color: bookmarked ? '#6b46c1' : '' }} />
        </div>
        <div className="post-action" onClick={() => {
          const shareText = `${post.content}\n\n- ${post.author?.name || 'IronLady'}`;
          navigator.clipboard.writeText(shareText).then(() => {
            alert('Post copied to clipboard!');
          }).catch(() => {
            alert('Post shared!');
          });
        }}>
          <FiShare2 className="post-action-icon" />
          <span>Share</span>
        </div>
      </div>
      
      <CommentModal
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        postId={post.id}
        userId={userId}
        userProfile={userProfile}
        isAdmin={isAdmin}
      />
      
      <EditPostModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        post={post}
        onPostUpdated={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}

export default PostCard;
