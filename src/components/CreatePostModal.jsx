import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

// Compress image function for faster uploads
const compressImage = (file, maxWidth = 1920, maxHeight = 1920, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Image compression failed'));
            }
          },
          file.type,
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
};

function CreatePostModal({ isOpen, onClose }) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [stateId, setStateId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [states, setStates] = useState([]);
  const [channels, setChannels] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setContent('');
      setImage(null);
      setImagePreview(null);
      setCategory('');
      setStateId('');
      setChannelId('');
      return;
    }

    // Get user profile to filter states
    const savedProfile = localStorage.getItem('userProfile');
    let userStateId = null;
    let userIsAdmin = false;
    const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
    const DEFAULT_ADMIN_EMAIL = 'admin@ironlady.com';
    
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        userStateId = profile.state;
        userIsAdmin = profile.isAdmin || 
                     profile.isSuperAdmin || 
                     profile.email === SUPERADMIN_EMAIL ||
                     profile.username === 'ironlady' ||
                     profile.email === DEFAULT_ADMIN_EMAIL;
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    } else {
      // No profile = default IronLady account = admin
      userIsAdmin = true;
    }
    
    setIsAdmin(userIsAdmin);

    // Fetch states
    const statesQuery = query(collection(db, 'states'));
    const statesUnsubscribe = onSnapshot(
      statesQuery, 
      (snapshot) => {
        let statesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('CreatePostModal - States fetched:', statesData);
        
        // Filter states: admins see all, regular users see only their state
        if (!userIsAdmin && userStateId) {
          statesData = statesData.filter(s => s.id === userStateId);
          // Auto-select user's state
          if (statesData.length > 0 && !stateId) {
            setStateId(userStateId);
          }
        } else if (statesData.length > 0 && !stateId) {
          // Admin: auto-select first state
          setStateId(statesData[0].id);
        }
        
        setStates(statesData);
      },
      (error) => {
        console.error('CreatePostModal - Error fetching states:', error);
      }
    );

    // Fetch channels
    const channelsQuery = query(collection(db, 'channels'));
    const channelsUnsubscribe = onSnapshot(
      channelsQuery, 
      (snapshot) => {
        let channelsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('CreatePostModal - Channels fetched:', channelsData);
        
        // Filter channels: admins see all, regular users see only their state's channels
        if (!userIsAdmin && userStateId) {
          channelsData = channelsData.filter(ch => ch.stateId === userStateId);
        }
        
        setChannels(channelsData);
      },
      (error) => {
        console.error('CreatePostModal - Error fetching channels:', error);
      }
    );

    return () => {
      statesUnsubscribe();
      channelsUnsubscribe();
    };
  }, [isOpen, stateId]);

  const getChannelsByState = (stateId) => {
    return channels.filter(ch => ch.stateId === stateId);
  };

  const handleStateChange = (newStateId) => {
    console.log('State changed to:', newStateId);
    setStateId(newStateId);
    setChannelId('');
    setCategory('');
    const stateChannels = getChannelsByState(newStateId);
    console.log('Channels for selected state:', stateChannels);
    if (stateChannels.length > 0) {
      setChannelId(stateChannels[0].id);
      setCategory(stateChannels[0].name);
    }
  };

  const handleChannelChange = (newChannelId) => {
    console.log('Channel changed to:', newChannelId);
    setChannelId(newChannelId);
    const channel = channels.find(ch => ch.id === newChannelId);
    if (channel) {
      setCategory(channel.name);
      console.log('Category set to:', channel.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!content.trim()) {
      alert('Please enter post content');
      return;
    }
    
    // Get user profile
    const savedProfile = localStorage.getItem('userProfile');
    let userIsAdmin = false;
    let userStateId = null;
    
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        userIsAdmin = profile.isAdmin || false;
        userStateId = profile.state;
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    }
    
    // For announcements, state and channel are not required
    if (!isAnnouncement) {
      if (!stateId) {
        alert('Please select a state');
        return;
      }
      
      if (!channelId) {
        alert('Please select a channel');
        return;
      }
      
      // Regular users can only post in their own state
      if (!userIsAdmin && userStateId && stateId !== userStateId) {
        alert('You can only post in your own state. Contact admin to access other states.');
        return;
      }
    } else if (!userIsAdmin) {
      alert('Only admins can create announcements');
      return;
    }

    // Prevent double submission
    if (uploading) {
      console.log('Already posting, please wait...');
      return;
    }

    setUploading(true);
    console.log('Starting post creation...');
    
    try {
      // Prepare state and channel data first (fast operation)
      let selectedState = null;
      let selectedChannel = null;
      
      if (!isAnnouncement) {
        selectedState = states.find(s => s.id === stateId);
        selectedChannel = channels.find(ch => ch.id === channelId);

        if (!selectedState) {
          setUploading(false);
          throw new Error('Selected state not found. Please refresh and try again.');
        }

        if (!selectedChannel) {
          setUploading(false);
          throw new Error('Selected channel not found. Please refresh and try again.');
        }
      }

      // Get user profile for author info (fast operation)
      const savedProfile = localStorage.getItem('userProfile');
      let authorInfo = {
        uid: user?.uid || 'guest',
        name: user?.displayName || 'IronLady',
        email: user?.email || '',
        isAdmin: false
      };
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          authorInfo = {
            uid: profile.id || user?.uid || 'guest',
            name: profile.name || user?.displayName || 'IronLady',
            email: profile.email || user?.email || '',
            isAdmin: profile.isAdmin || false
          };
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      }

      // Check if user is admin (for announcements)
      const userIsAdmin = authorInfo.isAdmin || user?.isAdmin || false;
      const makeAnnouncement = isAnnouncement && userIsAdmin;

      // Compress and upload image to Firebase Storage, and also store in Firestore
      let imageUrl = null;
      let imageBase64 = null;
      if (image) {
        console.log('Processing image for Firebase Storage and Firestore...');
        try {
          // Verify Firebase Storage is initialized
          if (!storage) {
            throw new Error('Firebase Storage is not initialized. Please check your Firebase configuration.');
          }
          
          // Compress image before uploading (faster upload)
          const compressedImage = await compressImage(image, 1920, 1920, 0.8);
          const originalSize = (image.size / 1024 / 1024).toFixed(2);
          const compressedSize = (compressedImage.size / 1024 / 1024).toFixed(2);
          console.log(`Image compressed: ${originalSize}MB → ${compressedSize}MB (${((1 - compressedImage.size/image.size) * 100).toFixed(0)}% reduction)`);
          
          // Convert compressed image to base64 for Firestore storage
          const base64Promise = new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result;
              console.log('Image converted to base64 for Firestore storage');
              resolve(base64String);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(compressedImage);
          });
          
          // Create Firebase Storage reference
          const timestamp = Date.now();
          const fileName = `${timestamp}_${compressedImage.name || image.name}`;
          const imageRef = ref(storage, `posts/${fileName}`);
          console.log(`Uploading to Firebase Storage: posts/${fileName}`);
          
          // Upload compressed image to Firebase Storage
          await uploadBytes(imageRef, compressedImage);
          console.log('Image uploaded to Firebase Storage successfully');
          
          // Get download URL from Firebase Storage
          imageUrl = await getDownloadURL(imageRef);
          console.log('Firebase Storage download URL obtained:', imageUrl);
          
          // Verify URL is from Firebase Storage
          if (!imageUrl.includes('firebasestorage.googleapis.com') && !imageUrl.includes('firebasestorage.app')) {
            console.warn('Warning: Image URL does not appear to be from Firebase Storage:', imageUrl);
          }
          
          // Convert to base64 for Firestore (store in database)
          imageBase64 = await base64Promise;
          if (imageBase64) {
            const base64Size = (imageBase64.length / 1024 / 1024).toFixed(2);
            console.log(`Image base64 size: ${base64Size}MB (stored in Firestore)`);
            
            // Warn if base64 is too large (Firestore has 1MB document limit)
            if (imageBase64.length > 900000) { // ~900KB to be safe
              console.warn('Warning: Base64 image is large. Firestore documents have a 1MB limit.');
            }
          }
        } catch (imageError) {
          console.error('Error processing image:', imageError);
          console.error('Image error details:', imageError.message, imageError.code);
          
          // Ask user if they want to continue without image
          const continueWithoutImage = window.confirm(
            `Image processing failed: ${imageError.message || 'Unknown error'}\n\n` +
            'Would you like to create the post without the image?'
          );
          
          if (!continueWithoutImage) {
            setUploading(false);
            return; // User cancelled
          }
          
          // Continue without image
          imageUrl = null;
          imageBase64 = null;
        }
      }

      // Create post with image URL and base64 (stored in Firestore database)
      // IMPORTANT: stateId and channelId are REQUIRED for regular posts (not announcements)
      // This ensures posts are only visible to members of that state
      const postData = {
        content: content.trim(),
        category: makeAnnouncement ? 'Announcement' : (category || selectedChannel?.name || 'General'),
        stateId: makeAnnouncement ? null : (stateId || null), // null for announcements, required for regular posts
        channelId: makeAnnouncement ? null : (channelId || null), // null for announcements, required for regular posts
        stateName: makeAnnouncement ? 'All States' : (selectedState?.name || ''),
        channelName: makeAnnouncement ? 'Announcement' : (selectedChannel?.name || ''),
        imageUrl: imageUrl, // Firebase Storage URL (for display)
        imageBase64: imageBase64, // Base64 image data (stored in Firestore database)
        author: authorInfo,
        isAnnouncement: makeAnnouncement,
        likes: 0,
        comments: 0,
        likedBy: [],
        bookmarkedBy: [],
        createdAt: serverTimestamp()
      };
      
      // Validate that regular posts have stateId and channelId
      if (!makeAnnouncement && (!postData.stateId || !postData.channelId)) {
        setUploading(false);
        alert('Error: Post must have a state and channel. Please try again.');
        return;
      }
      
      console.log('Post data to be stored in Firestore:', {
        ...postData,
        imageBase64: imageBase64 ? `${imageBase64.substring(0, 50)}... (${(imageBase64.length / 1024).toFixed(2)}KB)` : null
      });

      console.log('Creating post with data:', postData);

      // Create post with timeout (20 seconds to account for image upload)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Post creation timed out. Please check your connection and try again.')), 20000);
      });

      const createPostPromise = addDoc(collection(db, 'posts'), postData);
      const docRef = await Promise.race([createPostPromise, timeoutPromise]);

      console.log('Post created successfully with ID:', docRef.id);
      
      // Reset form
      setContent('');
      setImage(null);
      setImagePreview(null);
      setCategory('');
      setStateId('');
      setChannelId('');
      setIsAnnouncement(false);
      
      // Close modal and reset uploading state
      setUploading(false);
      onClose();
      
      // Show success message
      alert(makeAnnouncement ? 'Announcement posted successfully to all users!' : 'Post created successfully!');
      
    } catch (error) {
      console.error('Error creating post:', error);
      console.error('Error details:', error.message, error.code, error);
      
      // Always reset uploading state on error
      setUploading(false);
      
      // Show user-friendly error message
      let errorMessage = 'Unknown error occurred';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        errorMessage = `Firestore error: ${error.code}`;
      }
      
      alert(`Error creating post: ${errorMessage}\n\nPlease check:\n1. Firestore security rules\n2. Internet connection\n3. Browser console for details`);
    }
  };

  if (!isOpen) return null;

  const availableChannels = stateId ? getChannelsByState(stateId) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create New Post</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              required
            />
          </div>
          {isAdmin && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isAnnouncement}
                  onChange={(e) => {
                    setIsAnnouncement(e.target.checked);
                    if (e.target.checked) {
                      setStateId('');
                      setChannelId('');
                      setCategory('Announcement');
                    }
                  }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, color: '#6b46c1' }}>
                  📢 Post as Announcement (visible to all users)
                </span>
              </label>
              {isAnnouncement && (
                <p style={{ color: '#6b46c1', fontSize: '12px', marginTop: '5px', marginLeft: '28px' }}>
                  This announcement will be visible to all users across all states and channels.
                </p>
              )}
            </div>
          )}
          
          {!isAnnouncement && (
            <>
              <div className="form-group">
                <label className="form-label">State *</label>
                <select
                  className="form-select"
                  value={stateId}
                  onChange={(e) => handleStateChange(e.target.value)}
                  required
                  disabled={!isAdmin && states.length === 1}
                >
                  <option value="">Select a state...</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>{state.name}</option>
                  ))}
                </select>
                {!isAdmin && states.length === 1 && stateId && (
                  <p style={{ color: '#10b981', fontSize: '12px', marginTop: '5px', fontWeight: 600 }}>
                    ✓ Posting in your state: <strong>{states.find(s => s.id === stateId)?.name}</strong>
                  </p>
                )}
                {!isAdmin && !stateId && (
                  <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '5px' }}>
                    You can only post in your assigned state.
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Channel *</label>
                <select
                  className="form-select"
                  value={channelId}
                  onChange={(e) => handleChannelChange(e.target.value)}
                  required
                  disabled={!stateId || availableChannels.length === 0}
                >
                  <option value="">Select a channel...</option>
                  {availableChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>{channel.name}</option>
                  ))}
                </select>
                {stateId && availableChannels.length === 0 && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                    <p style={{ color: '#92400e', fontSize: '12px', margin: 0 }}>
                      ⚠️ No channels available for this state. Please add channels from Admin panel first, or select a different state.
                    </p>
                  </div>
                )}
                {stateId && availableChannels.length > 0 && channelId && (
                  <p style={{ color: '#10b981', fontSize: '12px', marginTop: '5px', fontWeight: 600 }}>
                    ✓ Posting in channel: <strong>{availableChannels.find(ch => ch.id === channelId)?.name}</strong>
                  </p>
                )}
                {stateId && availableChannels.length > 0 && !channelId && (
                  <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '5px' }}>
                    {availableChannels.length} channel(s) available - Please select one
                  </p>
                )}
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  // Validate file size (max 5MB)
                  if (file.size > 5 * 1024 * 1024) {
                    alert('Image size must be less than 5MB. Please choose a smaller image.');
                    e.target.value = '';
                    return;
                  }
                  // Validate file type
                  if (!file.type.startsWith('image/')) {
                    alert('Please select a valid image file.');
                    e.target.value = '';
                    return;
                  }
                  setImage(file);
                  // Create preview
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setImagePreview(reader.result);
                  };
                  reader.readAsDataURL(file);
                } else {
                  setImage(null);
                  setImagePreview(null);
                }
              }}
              className="form-input"
            />
            {imagePreview && (
              <div style={{ marginTop: '10px' }}>
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    objectFit: 'contain'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                  Image preview - {image?.name} ({(image?.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={uploading || (!isAnnouncement && (!stateId || !channelId)) || !content.trim()}
            >
              {uploading ? (image ? 'Uploading image...' : 'Posting...') : (isAnnouncement ? 'Post Announcement' : 'Post')}
            </button>
            {!isAnnouncement && (!stateId || !channelId) && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '5px', textAlign: 'center' }}>
                Please select both state and channel to post
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePostModal;
