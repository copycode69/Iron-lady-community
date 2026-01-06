import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiPlus, FiBook, FiClock, FiUsers, FiStar, FiTrash2, FiPlay, FiX } from 'react-icons/fi';

function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCourse, setLastCourse] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState('all'); // all, beginner, intermediate, advanced
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructor: '',
    duration: '',
    level: 'Beginner',
    price: ''
  });
  const COURSES_PER_PAGE = 20;

  // Check if user is admin
  useEffect(() => {
    const savedProfile = localStorage.getItem('userProfile');
    const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
    
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        // Only superadmin@gmail.com with username ironlady is superadmin
        setIsAdmin(profile.isAdmin || 
                   profile.isSuperAdmin || 
                   (profile.email === SUPERADMIN_EMAIL && profile.username === 'ironlady') ||
                   profile.username === 'ironlady');
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    } else {
      // No profile - not admin
      setIsAdmin(false);
    }
  }, []);

  const loadCourses = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      let q = query(
        collection(db, 'courses'),
        orderBy('createdAt', 'desc'),
        limit(COURSES_PER_PAGE)
      );

      if (filter !== 'all') {
        q = query(
          collection(db, 'courses'),
          orderBy('level'),
          orderBy('createdAt', 'desc'),
          limit(COURSES_PER_PAGE)
        );
      }

      if (!isInitial && lastCourse) {
        q = query(q, startAfter(lastCourse));
      }

      const snapshot = await getDocs(q);
      let coursesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter by level if needed
      if (filter !== 'all') {
        coursesData = coursesData.filter(course => course.level === filter);
      }

      if (isInitial) {
        setCourses(coursesData);
      } else {
        setCourses(prev => [...prev, ...coursesData]);
      }

      if (snapshot.docs.length < COURSES_PER_PAGE) {
        setHasMore(false);
      } else {
        setLastCourse(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(true);
      }

      setLoading(false);
      setLoadingMore(false);
    } catch (error) {
      console.error('Error loading courses:', error);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, lastCourse]);

  useEffect(() => {
    setLastCourse(null);
    setHasMore(true);
    setCourses([]);
    loadCourses(true);
  }, [filter]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadCourses(false);
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

      await addDoc(collection(db, 'courses'), {
        ...formData,
        students: [],
        rating: 0,
        reviews: 0,
        createdBy: creatorInfo,
        createdAt: serverTimestamp()
      });
      setFormData({
        title: '',
        description: '',
        instructor: '',
        duration: '',
        level: 'Beginner',
        price: ''
      });
      setIsModalOpen(false);
      // Reload courses
      setLastCourse(null);
      setHasMore(true);
      loadCourses(true);
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Error creating course');
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      const savedProfile = localStorage.getItem('userProfile');
      if (!savedProfile) {
        alert('Please create your profile first');
        window.location.href = '/';
        return;
      }

      const profile = JSON.parse(savedProfile);
      const studentInfo = {
        userId: profile.id || 'guest',
        name: profile.name,
        email: profile.email,
        enrolledAt: new Date()
      };

      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        students: arrayUnion(studentInfo)
      });
      
      alert('Successfully enrolled in the course!');
    } catch (error) {
      console.error('Error enrolling in course:', error);
      alert('Error enrolling in course. Please try again.');
    }
  };

  const handleDelete = async (courseId) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        await deleteDoc(doc(db, 'courses', courseId));
        setCourses(prev => prev.filter(c => c.id !== courseId));
      } catch (error) {
        console.error('Error deleting course:', error);
        alert('Error deleting course');
      }
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'Beginner': return '#10b981';
      case 'Intermediate': return '#f59e0b';
      case 'Advanced': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div>
      <div className="feed-header">
        <h1 className="feed-title">Courses</h1>
        <div className="feed-controls">
          <select 
            className="sort-dropdown"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Courses</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          {isAdmin && (
            <button 
              className="new-post-btn" 
              onClick={() => setIsModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
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
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}
            >
              <FiPlus style={{ fontSize: '18px' }} />
              Create Course
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading courses...</div>
      ) : courses.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: '12px',
          border: '2px solid #f59e0b'
        }}>
          <FiBook style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '20px' }} />
          <h3 style={{ color: '#92400e', marginBottom: '10px', fontSize: '24px', fontWeight: 700 }}>Courses Coming Soon!</h3>
          <p style={{ color: '#78350f', marginBottom: '20px', fontSize: '16px' }}>
            {isAdmin 
              ? "No courses yet. Create your first course to get started!"
              : "No courses available yet. Check back soon for new courses!"}
          </p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <FiPlus style={{ marginRight: '8px' }} />
              Create First Course
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {courses.map((course) => (
              <div key={course.id} className="stat-card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: '15px', marginBottom: '15px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    <FiBook />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                      {course.title}
                    </h3>
                    <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.5', marginBottom: '8px' }}>
                      {course.description || 'No description provided'}
                    </p>
                    {course.instructor && (
                      <p style={{ color: '#6b7280', fontSize: '12px' }}>
                        by {course.instructor}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '15px',
                  flexWrap: 'wrap'
                }}>
                  {course.level && (
                    <span style={{
                      background: getLevelColor(course.level) + '20',
                      color: getLevelColor(course.level),
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      {course.level}
                    </span>
                  )}
                  {course.duration && (
                    <span style={{
                      background: '#f3f4f6',
                      color: '#374151',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <FiClock style={{ fontSize: '10px' }} />
                      {course.duration}
                    </span>
                  )}
                  {course.students && (
                    <span style={{
                      background: '#f3f4f6',
                      color: '#374151',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <FiUsers style={{ fontSize: '10px' }} />
                      {course.students.length || 0}
                    </span>
                  )}
                </div>

                {course.rating > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '5px',
                    marginBottom: '15px',
                    color: '#f59e0b'
                  }}>
                    <FiStar style={{ fill: '#f59e0b' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>
                      {course.rating.toFixed(1)}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      ({course.reviews || 0} reviews)
                    </span>
                  </div>
                )}

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  paddingTop: '15px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#6b46c1' }}>
                    {course.price ? `$${course.price}` : 'Free'}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ fontSize: '14px', padding: '8px 16px' }}
                      onClick={() => handleEnroll(course.id)}
                    >
                      <FiPlay style={{ marginRight: '5px' }} />
                      Enroll
                    </button>
                    {(() => {
                      const savedProfile = localStorage.getItem('userProfile');
                      let canDelete = false;
                      if (savedProfile) {
                        try {
                          const profile = JSON.parse(savedProfile);
                          const isAdmin = profile.isAdmin || false;
                          const isCreator = course.createdBy?.email === profile.email;
                          canDelete = isAdmin || isCreator;
                        } catch (error) {
                          console.error('Error parsing profile:', error);
                        }
                      }
                      return canDelete ? (
                        <button 
                          className="action-btn btn-delete"
                          onClick={() => handleDelete(course.id)}
                          style={{ padding: '8px 12px' }}
                          title="Delete course"
                        >
                          <FiTrash2 />
                        </button>
                      ) : null;
                    })()}
                  </div>
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
                {loadingMore ? 'Loading...' : 'Load More Courses'}
              </button>
            </div>
          )}

          {!hasMore && courses.length > 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
              All courses loaded ({courses.length} total)
            </div>
          )}
        </>
      )}

      {/* Create Course Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Course</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Course Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter course title"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your course..."
                  rows="4"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Instructor</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.instructor}
                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                    placeholder="Instructor name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="e.g., 4 weeks, 10 hours"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Level</label>
                  <select
                    className="form-select"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Price ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0 for free"
                    min="0"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Courses;
