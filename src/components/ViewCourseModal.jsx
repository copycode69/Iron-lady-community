import { FiX, FiBook, FiClock, FiUsers, FiStar, FiPlay, FiImage, FiLink, FiEdit2 } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

function ViewCourseModal({ isOpen, onClose, course, onEnroll, onEdit }) {
  if (!isOpen || !course) return null;

  const getLevelColor = (level) => {
    switch (level) {
      case 'Beginner': return '#10b981';
      case 'Intermediate': return '#f59e0b';
      case 'Advanced': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const timeAgo = course.createdAt?.toDate 
    ? formatDistanceToNow(course.createdAt.toDate(), { addSuffix: true })
    : 'recently';

  // Check if user can edit (admin or creator)
  const canEdit = (() => {
    const savedProfile = localStorage.getItem('userProfile');
    if (!savedProfile) return false;
    try {
      const profile = JSON.parse(savedProfile);
      const isAdmin = profile.isAdmin || profile.isSuperAdmin || 
                     profile.email === 'superadmin@gmail.com' || 
                     profile.username === 'ironlady';
      const isCreator = course.createdBy?.email === profile.email;
      return isAdmin || isCreator;
    } catch (error) {
      return false;
    }
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
        maxWidth: '700px', 
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="modal-header" style={{ 
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
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
              <FiBook size={22} />
            </div>
            <h2 className="modal-title" style={{ 
              color: 'white', 
              margin: 0, 
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.02em'
            }}>
              Course Details
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f9fafb' }}>
          {/* Course Image */}
          {course.imageUrl && (
            <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden' }}>
              <img 
                src={course.imageUrl} 
                alt={course.title}
                style={{
                  width: '100%',
                  maxHeight: '300px',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Course Title */}
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 700, 
            color: '#1f2937', 
            marginBottom: '12px',
            lineHeight: '1.3'
          }}>
            {course.title}
          </h1>

          {/* Course Meta Info */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginBottom: '20px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            {course.level && (
              <span style={{
                background: getLevelColor(course.level) + '20',
                color: getLevelColor(course.level),
                padding: '6px 14px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600
              }}>
                {course.level}
              </span>
            )}
            {course.duration && (
              <span style={{
                background: '#f3f4f6',
                color: '#374151',
                padding: '6px 14px',
                borderRadius: '12px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <FiClock size={14} />
                {course.duration}
              </span>
            )}
            {course.students && (
              <span style={{
                background: '#f3f4f6',
                color: '#374151',
                padding: '6px 14px',
                borderRadius: '12px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <FiUsers size={14} />
                {course.students.length || 0} students
              </span>
            )}
            {course.rating > 0 && (
              <span style={{
                background: '#fef3c7',
                color: '#92400e',
                padding: '6px 14px',
                borderRadius: '12px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600
              }}>
                <FiStar size={14} style={{ fill: '#f59e0b' }} />
                {course.rating.toFixed(1)} ({course.reviews || 0} reviews)
              </span>
            )}
          </div>

          {/* Instructor */}
          {course.instructor && (
            <div style={{ 
              marginBottom: '20px',
              padding: '12px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Instructor</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                {course.instructor}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#1f2937', 
              marginBottom: '12px' 
            }}>
              About This Course
            </h3>
            <div style={{ 
              color: '#374151', 
              fontSize: '15px', 
              lineHeight: '1.7',
              background: 'white',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              whiteSpace: 'pre-wrap'
            }}>
              {course.description || 'No description provided for this course.'}
            </div>
          </div>

          {/* Course Link */}
          {course.link && (
            <div style={{ 
              marginBottom: '20px',
              padding: '16px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                marginBottom: '8px'
              }}>
                <FiLink size={18} style={{ color: '#6b46c1' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                  Course Link
                </span>
              </div>
              <a 
                href={course.link} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: '#6b46c1',
                  textDecoration: 'underline',
                  fontSize: '14px',
                  wordBreak: 'break-all'
                }}
              >
                {course.link}
              </a>
            </div>
          )}

          {/* Pricing */}
          <div style={{ 
            marginBottom: '20px',
            padding: '16px',
            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            borderRadius: '12px',
            border: '1px solid #d1d5db'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Pricing</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
              {course.mrp && course.mrp > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'line-through' }}>
                    MRP: ₹{course.mrp}
                  </span>
                </div>
              )}
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#6b46c1' }}>
                {course.price && course.price > 0 ? `₹${course.price}` : 'Free'}
              </div>
              {course.mrp && course.price && course.mrp > course.price && (
                <span style={{
                  background: '#10b981',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {Math.round(((course.mrp - course.price) / course.mrp) * 100)}% OFF
                </span>
              )}
            </div>
          </div>

          {/* Created Info */}
          {course.createdBy && (
            <div style={{ 
              fontSize: '12px', 
              color: '#9ca3af',
              marginBottom: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb'
            }}>
              Created by {course.createdBy.name || 'Admin'} • {timeAgo}
            </div>
          )}
        </div>

        {/* Footer with Enroll Button */}
        <div style={{ 
          padding: '20px 24px',
          background: 'white',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#6b46c1' }}>
            {course.price && course.price > 0 ? `₹${course.price}` : 'Free'}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {canEdit && onEdit && (
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  if (onEdit) {
                    onEdit(course);
                  }
                  onClose();
                }}
                style={{ 
                  fontSize: '14px', 
                  padding: '10px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600
                }}
              >
                <FiEdit2 size={16} />
                Edit Course
              </button>
            )}
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (onEnroll) {
                  onEnroll(course.id);
                }
                onClose();
              }}
              style={{ 
                fontSize: '16px', 
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600
              }}
            >
              <FiPlay size={18} />
              Enroll Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewCourseModal;

