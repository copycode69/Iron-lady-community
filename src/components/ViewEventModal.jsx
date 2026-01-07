import { FiX, FiCalendar, FiClock, FiMapPin, FiUsers, FiUser } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { format } from 'date-fns';

function ViewEventModal({ isOpen, onClose, event, onJoin }) {
  if (!isOpen || !event) return null;

  const formatEventDate = (dateString) => {
    if (!dateString) return 'TBD';
    try {
      const date = new Date(dateString);
      return format(date, 'EEEE, MMMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const isPastEvent = (dateString) => {
    if (!dateString) return false;
    try {
      return new Date(dateString) < new Date();
    } catch {
      return false;
    }
  };

  const timeAgo = event.createdAt?.toDate 
    ? formatDistanceToNow(event.createdAt.toDate(), { addSuffix: true })
    : 'recently';

  const isPast = isPastEvent(event.date);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
        maxWidth: '700px', 
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="modal-header" style={{ 
          background: isPast 
            ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' 
            : 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)', 
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
              <FiCalendar size={22} />
            </div>
            <h2 className="modal-title" style={{ 
              color: 'white', 
              margin: 0, 
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.02em'
            }}>
              Event Details
            </h2>
            {isPast && (
              <span style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                Past Event
              </span>
            )}
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
          {/* Event Title */}
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 700, 
            color: '#1f2937', 
            marginBottom: '16px',
            lineHeight: '1.3'
          }}>
            {event.title}
          </h1>

          {/* Event Date and Time */}
          <div style={{ 
            marginBottom: '20px',
            padding: '16px',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {event.date && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '8px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0
                }}>
                  <FiCalendar size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Date</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                    {formatEventDate(event.date)}
                  </div>
                </div>
              </div>
            )}
            {event.time && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '8px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0
                }}>
                  <FiClock size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Time</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                    {event.time}
                  </div>
                </div>
              </div>
            )}
            {event.location && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '8px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0
                }}>
                  <FiMapPin size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Location</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                    {event.location}
                  </div>
                </div>
              </div>
            )}
            {event.maxAttendees && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '8px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0
                }}>
                  <FiUsers size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Attendees</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                    {event.attendees?.length || 0} / {event.maxAttendees} registered
                    {event.maxAttendees && event.attendees?.length >= event.maxAttendees && (
                      <span style={{ 
                        marginLeft: '8px',
                        color: '#ef4444',
                        fontSize: '14px',
                        fontWeight: 500
                      }}>
                        (Full)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#1f2937', 
              marginBottom: '12px' 
            }}>
              About This Event
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
              {event.description || 'No description provided for this event.'}
            </div>
          </div>

          {/* Attendees List */}
          {event.attendees && event.attendees.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: 600, 
                color: '#1f2937', 
                marginBottom: '12px' 
              }}>
                Registered Attendees ({event.attendees.length})
              </h3>
              <div style={{ 
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {event.attendees.map((attendee, index) => (
                  <div 
                    key={index}
                    style={{
                      padding: '12px 16px',
                      borderBottom: index < event.attendees.length - 1 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '14px',
                      flexShrink: 0
                    }}>
                      <FiUser size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                        {attendee.name || 'Anonymous'}
                      </div>
                      {attendee.email && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {attendee.email}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Created Info */}
          {event.createdBy && (
            <div style={{ 
              fontSize: '12px', 
              color: '#9ca3af',
              marginBottom: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb'
            }}>
              Created by {event.createdBy.name || 'Admin'} • {timeAgo}
            </div>
          )}
        </div>

        {/* Footer with Join Button */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
            <FiUsers size={18} />
            <span>
              {event.attendees?.length || 0} 
              {event.maxAttendees ? ` / ${event.maxAttendees}` : ''} 
              {' '}registered
            </span>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              if (onJoin && !isPast) {
                onJoin(event.id);
              }
              if (isPast) {
                alert('This event has already passed.');
              }
              onClose();
            }}
            disabled={isPast || (event.maxAttendees && event.attendees?.length >= event.maxAttendees)}
            style={{ 
              fontSize: '16px', 
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              opacity: (isPast || (event.maxAttendees && event.attendees?.length >= event.maxAttendees)) ? 0.5 : 1,
              cursor: (isPast || (event.maxAttendees && event.attendees?.length >= event.maxAttendees)) ? 'not-allowed' : 'pointer'
            }}
          >
            <FiUsers size={18} />
            {isPast ? 'Event Ended' : (event.maxAttendees && event.attendees?.length >= event.maxAttendees) ? 'Event Full' : 'Join Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ViewEventModal;

