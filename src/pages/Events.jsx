import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiPlus, FiCalendar, FiMapPin, FiClock, FiUsers, FiTrash2, FiX } from 'react-icons/fi';
import { format } from 'date-fns';

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastEvent, setLastEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState('all'); // all, upcoming, past
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    maxAttendees: ''
  });
  const EVENTS_PER_PAGE = 20;

  // Check if user is admin
  useEffect(() => {
    const savedProfile = localStorage.getItem('userProfile');
    const SUPERADMIN_EMAIL = 'admin@ironlady.com';
    // Removed default guest admin email
    
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setIsAdmin(profile.isAdmin || 
                   profile.isSuperAdmin || 
                   profile.email === SUPERADMIN_EMAIL ||
                   profile.email === DEFAULT_ADMIN_EMAIL);
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    } else {
      // Default account is admin
      setIsAdmin(true);
    }
  }, []);

  const loadEvents = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      let q;
      const now = new Date().toISOString().split('T')[0];

      if (filter === 'upcoming') {
        q = query(
          collection(db, 'events'),
          where('date', '>=', now),
          orderBy('date', 'asc'),
          limit(EVENTS_PER_PAGE)
        );
      } else if (filter === 'past') {
        q = query(
          collection(db, 'events'),
          where('date', '<', now),
          orderBy('date', 'desc'),
          limit(EVENTS_PER_PAGE)
        );
      } else {
        q = query(
          collection(db, 'events'),
          orderBy('date', 'asc'),
          limit(EVENTS_PER_PAGE)
        );
      }

      if (!isInitial && lastEvent) {
        q = query(q, startAfter(lastEvent));
      }

      const snapshot = await getDocs(q);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (isInitial) {
        setEvents(eventsData);
      } else {
        setEvents(prev => [...prev, ...eventsData]);
      }

      if (snapshot.docs.length < EVENTS_PER_PAGE) {
        setHasMore(false);
      } else {
        setLastEvent(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(true);
      }

      setLoading(false);
      setLoadingMore(false);
    } catch (error) {
      console.error('Error loading events:', error);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, lastEvent]);

  useEffect(() => {
    setLastEvent(null);
    setHasMore(true);
    setEvents([]);
    loadEvents(true);
  }, [filter]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadEvents(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if user has profile
    const savedProfile = localStorage.getItem('userProfile');
    if (!savedProfile) {
      alert('Please create your profile first');
      window.location.href = '/';
      return;
    }
    
    try {
      // Get user profile
      let creatorInfo = {
        name: 'User',
        email: 'user@ironlady.com'
      };
      
      try {
        const profile = JSON.parse(savedProfile);
        creatorInfo = {
          name: profile.name || 'User',
          email: profile.email || 'user@ironlady.com'
        };
      } catch (error) {
        console.error('Error parsing profile:', error);
        alert('Error reading your profile. Please try again.');
        return;
      }

      await addDoc(collection(db, 'events'), {
        ...formData,
        attendees: [],
        createdBy: creatorInfo,
        createdAt: serverTimestamp()
      });
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        location: '',
        maxAttendees: ''
      });
      setIsModalOpen(false);
      // Reload events
      setLastEvent(null);
      setHasMore(true);
      loadEvents(true);
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Error creating event');
    }
  };

  const handleJoinEvent = async (eventId) => {
    try {
      const savedProfile = localStorage.getItem('userProfile');
      if (!savedProfile) {
        alert('Please create your profile first');
        window.location.href = '/';
        return;
      }

      const profile = JSON.parse(savedProfile);
      const attendeeInfo = {
        userId: profile.id || 'guest',
        name: profile.name,
        email: profile.email,
        joinedAt: new Date()
      };

      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        attendees: arrayUnion(attendeeInfo)
      });
      
      alert('Successfully joined the event!');
    } catch (error) {
      console.error('Error joining event:', error);
      alert('Error joining event. Please try again.');
    }
  };

  const handleDelete = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
        setEvents(prev => prev.filter(e => e.id !== eventId));
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error deleting event');
      }
    }
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return 'TBD';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
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

  return (
    <div>
      <div className="feed-header">
        <h1 className="feed-title">Events</h1>
        <div className="feed-controls">
          <select 
            className="sort-dropdown"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Events</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past Events</option>
          </select>
          {isAdmin && (
            <button 
              className="new-post-btn" 
              onClick={() => setIsModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(107, 70, 193, 0.3)'
              }}
            >
              <FiPlus style={{ fontSize: '18px' }} />
              Create Event
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading events...</div>
      ) : events.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: '12px',
          border: '2px solid #f59e0b'
        }}>
          <FiCalendar style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '20px' }} />
          <h3 style={{ color: '#92400e', marginBottom: '10px', fontSize: '24px', fontWeight: 700 }}>Events Coming Soon!</h3>
          <p style={{ color: '#78350f', marginBottom: '20px', fontSize: '16px' }}>
            {isAdmin 
              ? "No events yet. Create your first event to get started!"
              : "No events available yet. Check back soon for new events!"}
          </p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <FiPlus style={{ marginRight: '8px' }} />
              Create First Event
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {events.map((event) => (
              <div 
                key={event.id} 
                className="stat-card"
                style={{ 
                  position: 'relative',
                  opacity: isPastEvent(event.date) ? 0.7 : 1
                }}
              >
                {isPastEvent(event.date) && (
                  <div style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    background: '#ef4444',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    Past
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'start', gap: '15px', marginBottom: '15px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    <FiCalendar />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                      {event.title}
                    </h3>
                    <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
                      {event.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {event.date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#374151' }}>
                        <FiCalendar style={{ color: '#6b46c1' }} />
                        <span style={{ fontSize: '14px' }}>{formatEventDate(event.date)}</span>
                      </div>
                    )}
                    {event.time && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#374151' }}>
                        <FiClock style={{ color: '#6b46c1' }} />
                        <span style={{ fontSize: '14px' }}>{event.time}</span>
                      </div>
                    )}
                    {event.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#374151' }}>
                        <FiMapPin style={{ color: '#6b46c1' }} />
                        <span style={{ fontSize: '14px' }}>{event.location}</span>
                      </div>
                    )}
                    {event.maxAttendees && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#374151' }}>
                        <FiUsers style={{ color: '#6b46c1' }} />
                        <span style={{ fontSize: '14px' }}>
                          {event.attendees?.length || 0} / {event.maxAttendees} attendees
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1, fontSize: '14px', padding: '10px' }}
                    onClick={() => handleJoinEvent(event.id)}
                  >
                    Join Event
                  </button>
                  {(() => {
                    const savedProfile = localStorage.getItem('userProfile');
                    let canDelete = false;
                    if (savedProfile) {
                      try {
                        const profile = JSON.parse(savedProfile);
                        const isAdmin = profile.isAdmin || false;
                        const isCreator = event.createdBy?.email === profile.email;
                        canDelete = isAdmin || isCreator;
                      } catch (error) {
                        console.error('Error parsing profile:', error);
                      }
                    }
                    return canDelete ? (
                      <button 
                        className="action-btn btn-delete"
                        onClick={() => handleDelete(event.id)}
                        style={{ padding: '10px' }}
                        title="Delete event"
                      >
                        <FiTrash2 />
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <button 
                className="btn btn-primary"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More Events'}
              </button>
            </div>
          )}

          {!hasMore && events.length > 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
              All events loaded ({events.length} total)
            </div>
          )}
        </>
      )}

      {/* Create Event Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Event</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Event Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter event title"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your event..."
                  rows="4"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Event location or online"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Attendees (optional)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.maxAttendees}
                  onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Events;
