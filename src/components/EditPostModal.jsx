import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          file.type,
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

function EditPostModal({ isOpen, onClose, post, onPostUpdated }) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (isOpen && post) {
      setContent(post.content || '');
      setImage(null);
      setImagePreview(post.imageUrl || post.imageBase64 || null);
      setRemoveImage(false);
    }
  }, [isOpen, post]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!content.trim()) {
      alert('Please enter post content');
      return;
    }

    if (uploading) {
      console.log('Already updating, please wait...');
      return;
    }

    setUploading(true);
    console.log('Starting post update...');
    
    try {
      const postRef = doc(db, 'posts', post.id);
      let updateData = {
        content: content.trim(),
        updatedAt: new Date()
      };

      // Handle image changes
      if (removeImage) {
        // Remove image
        updateData.imageUrl = null;
        updateData.imageBase64 = null;
        
        // Delete from Firebase Storage if exists
        if (post.imageUrl) {
          try {
            const imageRef = ref(storage, post.imageUrl);
            await deleteObject(imageRef);
            console.log('Old image deleted from Firebase Storage');
          } catch (error) {
            console.log('Note: Could not delete old image from Storage:', error);
            // Continue even if deletion fails
          }
        }
      } else if (image) {
        // New image uploaded
        console.log('Processing new image for Firebase Storage upload...');
        try {
          if (!storage) {
            throw new Error('Firebase Storage is not initialized.');
          }
          
          const compressedImage = await compressImage(image, 1920, 1920, 0.8);
          console.log(`Image compressed: ${image.size} bytes → ${compressedImage.size} bytes`);

          const timestamp = Date.now();
          const fileName = `${timestamp}_${compressedImage.name || image.name}`;
          const imageRef = ref(storage, `posts/${fileName}`);
          console.log(`Uploading to Firebase Storage: posts/${fileName}`);

          await uploadBytes(imageRef, compressedImage);
          console.log('Image uploaded to Firebase Storage successfully');

          const imageUrl = await getDownloadURL(imageRef);
          console.log('Firebase Storage download URL obtained:', imageUrl);

          updateData.imageUrl = imageUrl;

          // Convert compressed image to base64 for Firestore storage (fallback)
          const imageBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(compressedImage);
          });
          
          if (imageBase64.length > 1000000) {
            console.warn('Base64 image is large (>1MB), storing only URL in Firestore');
          } else {
            updateData.imageBase64 = imageBase64;
          }

          // Delete old image from Storage if exists
          if (post.imageUrl && post.imageUrl !== imageUrl) {
            try {
              const oldImageRef = ref(storage, post.imageUrl);
              await deleteObject(oldImageRef);
              console.log('Old image deleted from Firebase Storage');
            } catch (error) {
              console.log('Note: Could not delete old image from Storage:', error);
            }
          }
        } catch (imageError) {
          console.error('Error uploading image to Firebase Storage:', imageError);
          const continueWithoutImage = window.confirm(
            `Error uploading image: ${imageError.message}\n\nDo you want to continue updating the post without the new image?`
          );
          if (!continueWithoutImage) {
            setUploading(false);
            return;
          }
        }
      }

      console.log('Updating post with data:', updateData);
      await updateDoc(postRef, updateData);
      console.log('Post updated successfully');

      setUploading(false);
      alert('Post updated successfully!');
      onPostUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating post:', error);
      alert(`Error updating post: ${error.message || 'Please try again.'}`);
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Post</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              required
              rows="6"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Image</label>
            {imagePreview && !removeImage && (
              <div style={{ marginBottom: '15px', position: 'relative' }}>
                <img 
                  src={imagePreview} 
                  alt="Current" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '200px', 
                    objectFit: 'contain', 
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }} 
                />
                <button
                  type="button"
                  onClick={() => {
                    setRemoveImage(true);
                    setImagePreview(null);
                    setImage(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}
                >
                  ×
                </button>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                  Current image (click × to remove)
                </p>
              </div>
            )}
            {!imagePreview || removeImage ? (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    // Validate file size (max 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                      alert('Image size must be less than 5MB');
                      return;
                    }
                    // Validate file type
                    if (!file.type.startsWith('image/')) {
                      alert('Please select a valid image file');
                      return;
                    }
                    setImage(file);
                    setRemoveImage(false);
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
            ) : null}
            {imagePreview && !removeImage && (
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                Upload a new image to replace the current one
              </p>
            )}
            {image && (
              <div style={{ marginTop: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', background: '#f9fafb' }}>
                <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '6px' }} />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '10px' }}>
                  New image: {image.name} ({(image.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={uploading || !content.trim()}
            >
              {uploading ? (image ? 'Uploading image...' : 'Updating...') : 'Update Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPostModal;

