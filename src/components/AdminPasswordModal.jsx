import { useState } from 'react';
import { FiLock, FiX, FiEye, FiEyeOff } from 'react-icons/fi';

function AdminPasswordModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Check if user is super admin via login
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        const isSuperAdmin = profile.email === 'superadmin@gmail.com' || 
                            profile.username === 'ironlady' ||
                            profile.isSuperAdmin === true;
        if (isSuperAdmin) {
          // Store authentication in sessionStorage
          sessionStorage.setItem('adminAuthenticated', 'true');
          setPassword('');
          setError('');
          onSuccess();
        } else {
          setError('Only super admin can access this section. Please login with superadmin@gmail.com');
          setPassword('');
        }
      } catch (error) {
        setError('Error checking admin status. Please login first.');
        setPassword('');
      }
    } else {
      setError('Please login first with superadmin@gmail.com');
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Admin Access</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <FiLock style={{ marginRight: '8px', color: '#6b46c1' }} />
              Verify Super Admin Access
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Click to verify (login required)"
                disabled
                required
                autoFocus
                style={{ paddingRight: '45px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {error && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '5px' }}>
                {error}
              </p>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Verify & Access
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminPasswordModal;

