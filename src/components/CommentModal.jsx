import { useState, useEffect } from 'react';
import { FiX, FiHeart, FiShare2, FiEdit2, FiTrash2, FiSend } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  getDoc,
  doc,
  serverTimestamp,
  orderBy,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/config';

function CommentModal({ isOpen, onClose, postId, userId, userProfile, isAdmin }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !postId) return;

    const commentsQuery = query(
      collection(db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const commentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setComments(commentsData);
      },
      (error) => {
        console.error('Error fetching comments:', error);
      }
    );

    return () => unsubscribe();
  }, [isOpen, postId]);

  const handleAddComment = async () => {
    if (!newComment.trim() || loading) return;

    setLoading(true);
    try {
      const commentData = {
        text: newComment.trim(),
        author: {
          id: userId || 'guest',
          name: userProfile?.name || 'Guest',
          email: userProfile?.email || '',
          isAdmin: userProfile?.isAdmin || false
        },
        likes: 0,
        likedBy: [],
        shares: 0,
        sharedBy: [],
        createdAt: serverTimestamp(),
        updatedAt: null
      };

      await addDoc(collection(db, 'posts', postId, 'comments'), commentData);
      
      // Update post comment count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        comments: increment(1)
      });

      // Create notification for post author when someone comments
      try {
        const postDoc = await getDoc(postRef);
        const postData = postDoc.data();
        const postAuthorId = postData?.author?.id || postData?.author?.uid;
        
        if (postAuthorId && userId && userId !== 'guest' && userId !== postAuthorId) {
          const { createCommentNotification } = await import('../utils/notifications');
          const commenterName = userProfile?.name || 'Someone';
          await createCommentNotification(
            postAuthorId, 
            commenterName, 
            postId, 
            commentData.text, 
            postData?.content
          );
        }
      } catch (error) {
        console.error('Error creating comment notification:', error);
        // Don't block comment action if notification fails
      }

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Error adding comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLikeComment = async (commentId, isLiked, currentLikes, likedBy) => {
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      
      if (isLiked) {
        await updateDoc(commentRef, {
          likes: increment(1),
          likedBy: arrayUnion(userId || 'guest')
        });
      } else {
        await updateDoc(commentRef, {
          likes: increment(-1),
          likedBy: arrayRemove(userId || 'guest')
        });
      }
    } catch (error) {
      console.error('Error liking comment:', error);
      alert('Error liking comment. Please try again.');
    }
  };

  const handleShareComment = async (commentId, currentShares, sharedBy) => {
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      
      if (!sharedBy.includes(userId || 'guest')) {
        await updateDoc(commentRef, {
          shares: increment(1),
          sharedBy: arrayUnion(userId || 'guest')
        });
        
        // Copy comment text to clipboard
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
          const shareText = `"${comment.text}" - ${comment.author?.name || 'Guest'}`;
          navigator.clipboard.writeText(shareText).then(() => {
            alert('Comment copied to clipboard!');
          }).catch(() => {
            alert('Comment shared!');
          });
        }
      } else {
        alert('You have already shared this comment.');
      }
    } catch (error) {
      console.error('Error sharing comment:', error);
      alert('Error sharing comment. Please try again.');
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;

    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      await updateDoc(commentRef, {
        text: editText.trim(),
        updatedAt: serverTimestamp()
      });

      setEditingCommentId(null);
      setEditText('');
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Error editing comment. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
      
      // Update post comment count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        comments: increment(-1)
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Error deleting comment. Please try again.');
    }
  };

  const startEditing = (comment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.text);
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const canEditOrDelete = (comment) => {
    if (isAdmin) return true;
    return comment.author?.id === userId;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '15px' }}>
          <h2 className="modal-title">Comments</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', minHeight: '200px' }}>
          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {comments.map((comment) => {
                const isLiked = comment.likedBy?.includes(userId || 'guest') || false;
                const isShared = comment.sharedBy?.includes(userId || 'guest') || false;
                const canEdit = canEditOrDelete(comment);

                return (
                  <div 
                    key={comment.id} 
                    style={{
                      padding: '15px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                          <span style={{ fontWeight: 600, color: '#1f2937' }}>
                            {comment.author?.name || 'Guest'}
                          </span>
                          {comment.author?.isAdmin && (
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
                          )}
                          <span style={{ color: '#6b7280', fontSize: '12px' }}>
                            {comment.createdAt?.toDate 
                              ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true })
                              : 'just now'}
                          </span>
                          {comment.updatedAt && (
                            <span style={{ color: '#9ca3af', fontSize: '11px', fontStyle: 'italic' }}>
                              (edited)
                            </span>
                          )}
                        </div>
                        {editingCommentId === comment.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px',
                                minHeight: '60px',
                                resize: 'vertical'
                              }}
                              autoFocus
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleEditComment(comment.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#6b46c1',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                style={{
                                  padding: '6px 12px',
                                  background: '#e5e7eb',
                                  color: '#374151',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: '#374151', fontSize: '14px', lineHeight: '1.6', marginBottom: '10px' }}>
                            {comment.text}
                          </div>
                        )}
                      </div>
                      {canEdit && editingCommentId !== comment.id && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => startEditing(comment)}
                            style={{
                              padding: '4px 8px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#6b7280'
                            }}
                            title="Edit"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            style={{
                              padding: '4px 8px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#ef4444'
                            }}
                            title="Delete"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleLikeComment(comment.id, !isLiked, comment.likes || 0, comment.likedBy || [])}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: isLiked ? '#ef4444' : '#6b7280',
                          fontSize: '13px'
                        }}
                      >
                        <FiHeart size={16} fill={isLiked ? '#ef4444' : 'none'} />
                        <span>{comment.likes || 0}</span>
                      </button>
                      <button
                        onClick={() => handleShareComment(comment.id, comment.shares || 0, comment.sharedBy || [])}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: isShared ? '#6b46c1' : '#6b7280',
                          fontSize: '13px'
                        }}
                      >
                        <FiShare2 size={16} />
                        <span>{comment.shares || 0}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleAddComment();
                }
              }}
              placeholder="Write a comment... (Ctrl+Enter to submit)"
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minHeight: '60px',
                resize: 'vertical'
              }}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || loading}
              style={{
                padding: '10px 20px',
                background: newComment.trim() && !loading ? '#6b46c1' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: newComment.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600
              }}
            >
              <FiSend size={18} />
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommentModal;

