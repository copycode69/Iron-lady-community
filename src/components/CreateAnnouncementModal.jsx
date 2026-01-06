import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

function CreateAnnouncementModal({ isOpen, onClose, user }) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!content.trim()) {
      alert('Please enter announcement content');
      return;
    }

    // Prevent double submission
    if (uploading) {
      console.log('Already posting, please wait...');
      return;
    }

    setUploading(true);
    console.log('Starting announcement creation...');
    
    try {
      let imageUrl = null;

      // Upload image to Firebase Storage if provided
      if (image) {
        console.log('Uploading image to Firebase Storage...');
        try {
          // Verify Firebase Storage is initialized
          if (!storage) {
            throw new Error('Firebase Storage is not initialized.');
          }
          
          // Create Firebase Storage reference
          const timestamp = Date.now();
          const fileName = `${timestamp}_${image.name}`;
          const imageRef = ref(storage, `posts/${fileName}`);
          console.log(`Uploading to Firebase Storage: posts/${fileName}`);
          
          // Upload to Firebase Storage
          await uploadBytes(imageRef, image);
          console.log('Image uploaded to Firebase Storage successfully');
          
          // Get download URL from Firebase Storage
          imageUrl = await getDownloadURL(imageRef);
          console.log('Firebase Storage download URL obtained:', imageUrl);
        } catch (imageError) {
          console.error('Error uploading image to Firebase Storage:', imageError);
          // Continue without image
        }
      }

      // Get user profile for author info
      const savedProfile = localStorage.getItem('userProfile');
      let authorInfo = {
        uid: user?.uid || 'admin',
        name: user?.displayName || 'IronLady',
        email: user?.email || 'admin@ironlady.com',
        isAdmin: true
      };
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          authorInfo = {
            uid: profile.id || user?.uid || 'admin',
            name: profile.name || user?.displayName || 'IronLady',
            email: profile.email || user?.email || 'admin@ironlady.com',
            isAdmin: profile.isAdmin || true
          };
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      }

      const announcementData = {
        content: content.trim(),
        category: 'Announcement',
        stateId: null, // Announcements don't need state/channel
        channelId: null,
        stateName: 'All States',
        channelName: 'Announcement',
        imageUrl,
        author: authorInfo,
        isAnnouncement: true,
        likes: 0,
        comments: 0,
        likedBy: [],
        bookmarkedBy: [],
        createdAt: serverTimestamp()
      };

      console.log('Creating announcement with data:', announcementData);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Announcement creation timed out. Please try again.')), 30000);
      });

      const createAnnouncementPromise = addDoc(collection(db, 'posts'), announcementData);
      
      const docRef = await Promise.race([createAnnouncementPromise, timeoutPromise]);

      console.log('Announcement created successfully with ID:', docRef.id);
      
      // Reset form
      setContent('');
      setImage(null);
      
      // Close modal and reset uploading state
      setUploading(false);
      onClose();
      
      // Show success message
      alert('Announcement posted successfully to all users!');
      
    } catch (error) {
      console.error('Error creating announcement:', error);
      console.error('Error details:', error.message, error.code, error);
      
      // Always reset uploading state on error
      setUploading(false);
      
      // Show user-friendly error message
      const errorMessage = error.message || error.code || 'Unknown error occurred';
      alert(`Error creating announcement: ${errorMessage}\n\nPlease check:\n1. Firestore security rules\n2. Internet connection\n3. Browser console for details`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📢 Create Announcement</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <div style={{ 
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '2px solid #f59e0b'
        }}>
          <p style={{ color: '#92400e', fontSize: '14px', margin: 0, fontWeight: 600 }}>
            ⚠️ This announcement will be visible to ALL users across ALL states and channels.
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Announcement Content *</label>
            <textarea
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your announcement message..."
              required
              rows="6"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
              className="form-input"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={uploading || !content.trim()}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              }}
            >
              {uploading ? 'Posting Announcement...' : '📢 Post Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateAnnouncementModal;

