import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Create a notification in Firestore
 * @param {string} userId - The user ID who should receive the notification
 * @param {string} type - Type of notification: 'welcome', 'like', 'comment'
 * @param {string} message - The notification message
 * @param {object} metadata - Additional data (postId, postAuthor, etc.)
 */
export const createNotification = async (userId, type, message, metadata = {}) => {
  if (!userId || userId === 'guest' || userId === 'admin') {
    // Don't create notifications for guest or admin users
    return;
  }

  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      message,
      read: false,
      createdAt: serverTimestamp(),
      ...metadata
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw error - notifications are not critical
  }
};

/**
 * Create a welcome notification for new users
 */
export const createWelcomeNotification = async (userId, userName) => {
  if (!userId || userId === 'guest' || userId === 'admin') {
    return;
  }

  await createNotification(
    userId,
    'welcome',
    `Welcome to Iron Lady Community, ${userName}! 🎉 We're excited to have you here. Start exploring posts, connecting with members, and sharing your thoughts!`,
    {
      title: 'Welcome!'
    }
  );
};

/**
 * Create a notification when someone likes a post
 */
export const createLikeNotification = async (postAuthorId, likerName, postId, postContent) => {
  if (!postAuthorId || postAuthorId === 'guest' || postAuthorId === 'admin') {
    return;
  }

  // Don't notify if user likes their own post
  const savedProfile = localStorage.getItem('userProfile');
  if (savedProfile) {
    try {
      const profile = JSON.parse(savedProfile);
      if (profile.id === postAuthorId) {
        return; // User is liking their own post
      }
    } catch (error) {
      console.error('Error parsing profile:', error);
    }
  }

  const contentPreview = postContent?.substring(0, 50) || 'your post';
  const message = `${likerName} liked your post: "${contentPreview}${postContent?.length > 50 ? '...' : ''}"`;

  await createNotification(
    postAuthorId,
    'like',
    message,
    {
      title: 'New Like',
      postId,
      actorName: likerName
    }
  );
};

/**
 * Create a notification when someone comments on a post
 */
export const createCommentNotification = async (postAuthorId, commenterName, postId, commentText, postContent) => {
  if (!postAuthorId || postAuthorId === 'guest' || postAuthorId === 'admin') {
    return;
  }

  // Don't notify if user comments on their own post
  const savedProfile = localStorage.getItem('userProfile');
  if (savedProfile) {
    try {
      const profile = JSON.parse(savedProfile);
      if (profile.id === postAuthorId) {
        return; // User is commenting on their own post
      }
    } catch (error) {
      console.error('Error parsing profile:', error);
    }
  }

  const postPreview = postContent?.substring(0, 50) || 'your post';
  const commentPreview = commentText?.substring(0, 50) || '';
  const message = `${commenterName} commented on your post: "${postPreview}${postContent?.length > 50 ? '...' : ''}"\n\n"${commentPreview}${commentText?.length > 50 ? '...' : ''}"`;

  await createNotification(
    postAuthorId,
    'comment',
    message,
    {
      title: 'New Comment',
      postId,
      actorName: commenterName,
      commentText: commentPreview
    }
  );
};

