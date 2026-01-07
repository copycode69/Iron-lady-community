import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiPlus, FiBook, FiClock, FiUsers, FiStar, FiTrash2, FiPlay, FiX, FiImage, FiLink, FiEdit2 } from 'react-icons/fi';
import ViewCourseModal from '../components/ViewCourseModal';

function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCourse, setLastCourse] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState('all'); // all, beginner, intermediate, advanced
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructor: '',
    duration: '',
    level: 'Beginner',
    price: '',
    mrp: '',
    imageUrl: '',
    link: ''
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

      if (editingCourse) {
        // Update existing course
        const courseRef = doc(db, 'courses', editingCourse.id);
        await updateDoc(courseRef, {
          title: formData.title,
          description: formData.description,
          instructor: formData.instructor,
          duration: formData.duration,
          level: formData.level,
          price: formData.price ? parseFloat(formData.price) || 0 : 0,
          mrp: formData.mrp ? parseFloat(formData.mrp) || 0 : 0,
          imageUrl: formData.imageUrl || null,
          link: formData.link || null,
          updatedAt: serverTimestamp()
        });
        alert('Course updated successfully!');
        setEditingCourse(null);
      } else {
        // Create new course
        await addDoc(collection(db, 'courses'), {
          ...formData,
          price: formData.price ? parseFloat(formData.price) || 0 : 0,
          mrp: formData.mrp ? parseFloat(formData.mrp) || 0 : 0,
          imageUrl: formData.imageUrl || null,
          link: formData.link || null,
          students: [],
          rating: 0,
          reviews: 0,
          createdBy: creatorInfo,
          createdAt: serverTimestamp()
        });
        alert('Course created successfully!');
      }
      
      setFormData({
        title: '',
        description: '',
        instructor: '',
        duration: '',
        level: 'Beginner',
        price: '',
        mrp: '',
        imageUrl: '',
        link: ''
      });
      setIsModalOpen(false);
      // Reload courses
      setLastCourse(null);
      setHasMore(true);
      loadCourses(true);
    } catch (error) {
      console.error('Error saving course:', error);
      alert(`Error ${editingCourse ? 'updating' : 'creating'} course`);
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title || '',
      description: course.description || '',
      instructor: course.instructor || '',
      duration: course.duration || '',
      level: course.level || 'Beginner',
      price: course.price ? course.price.toString() : '',
      mrp: course.mrp ? course.mrp.toString() : '',
      imageUrl: course.imageUrl || '',
      link: course.link || ''
    });
    setIsViewModalOpen(false);
    setIsModalOpen(true);
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
            {courses.map((course) => (
              <div 
                key={course.id} 
                style={{ 
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onClick={() => {
                  setSelectedCourse(course);
                  setIsViewModalOpen(true);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.12)';
                  e.currentTarget.style.borderColor = '#c7d2fe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                {/* Course Image/Header */}
                <div style={{
                  width: '100%',
                  height: '180px',
                  background: course.imageUrl 
                    ? 'transparent' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {course.imageUrl ? (
                    <img 
                      src={course.imageUrl} 
                      alt={course.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      <FiBook size={48} />
                    </div>
                  )}
                  {course.level && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: getLevelColor(course.level),
                      color: 'white',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}>
                      {course.level}
                    </div>
                  )}
                </div>

                {/* Course Content */}
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Title and Instructor */}
                  <div style={{ marginBottom: '12px' }}>
                    <h3 style={{ 
                      fontSize: '22px', 
                      fontWeight: 700, 
                      color: '#1f2937', 
                      marginBottom: '8px',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {course.title}
                    </h3>
                    {course.instructor && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        color: '#6b7280',
                        fontSize: '13px'
                      }}>
                        <span style={{ fontWeight: 500 }}>by {course.instructor}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p style={{ 
                    color: '#6b7280', 
                    fontSize: '14px', 
                    lineHeight: '1.6', 
                    marginBottom: '16px',
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {course.description || 'No description provided'}
                  </p>

                  {/* Meta Info */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                  }}>
                    {course.duration && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#6b7280',
                        fontSize: '13px',
                        background: '#f9fafb',
                        padding: '6px 12px',
                        borderRadius: '8px'
                      }}>
                        <FiClock size={14} />
                        <span>{course.duration}</span>
                      </div>
                    )}
                    {course.students && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#6b7280',
                        fontSize: '13px',
                        background: '#f9fafb',
                        padding: '6px 12px',
                        borderRadius: '8px'
                      }}>
                        <FiUsers size={14} />
                        <span>{course.students.length || 0} students</span>
                      </div>
                    )}
                    {course.rating > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#f59e0b',
                        fontSize: '13px',
                        background: '#fef3c7',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontWeight: 600
                      }}>
                        <FiStar size={14} style={{ fill: '#f59e0b' }} />
                        <span>{course.rating.toFixed(1)}</span>
                        <span style={{ color: '#6b7280', fontWeight: 400 }}>
                          ({course.reviews || 0})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price and Actions */}
                  <div style={{ 
                    paddingTop: '16px',
                    borderTop: '2px solid #f3f4f6',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 700, 
                        color: '#6b46c1',
                        lineHeight: '1'
                      }}>
                        {course.price && course.price > 0 ? `₹${course.price}` : 'Free'}
                      </div>
                      {course.mrp && course.mrp > course.price && (
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#9ca3af', 
                          textDecoration: 'line-through',
                          fontWeight: 400
                        }}>
                          MRP: ₹{course.mrp}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ 
                          fontSize: '13px', 
                          padding: '10px 18px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          boxShadow: '0 2px 4px rgba(107, 70, 193, 0.2)'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourse(course);
                          setIsViewModalOpen(true);
                        }}
                      >
                        View
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ 
                          fontSize: '13px', 
                          padding: '10px 18px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(107, 70, 193, 0.2)'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnroll(course.id);
                        }}
                      >
                        <FiPlay size={14} />
                        Enroll
                      </button>
                      {(() => {
                        const savedProfile = localStorage.getItem('userProfile');
                        let canEdit = false;
                        let canDelete = false;
                        if (savedProfile) {
                          try {
                            const profile = JSON.parse(savedProfile);
                            const isAdmin = profile.isAdmin || profile.isSuperAdmin || 
                                           profile.email === 'superadmin@gmail.com' || 
                                           profile.username === 'ironlady';
                            const isCreator = course.createdBy?.email === profile.email;
                            canEdit = isAdmin || isCreator;
                            canDelete = isAdmin || isCreator;
                          } catch (error) {
                            console.error('Error parsing profile:', error);
                          }
                        }
                        return (
                          <>
                            {canEdit && (
                              <button 
                                className="action-btn btn-edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(course);
                                }}
                                style={{ 
                                  padding: '10px',
                                  borderRadius: '8px',
                                  minWidth: '40px',
                                  height: '40px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Edit course"
                              >
                                <FiEdit2 size={16} />
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                className="action-btn btn-delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(course.id);
                                }}
                                style={{ 
                                  padding: '10px',
                                  borderRadius: '8px',
                                  minWidth: '40px',
                                  height: '40px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Delete course"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
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

      {/* Create/Edit Course Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsModalOpen(false);
          setEditingCourse(null);
          setFormData({
            title: '',
            description: '',
            instructor: '',
            duration: '',
            level: 'Beginner',
            price: '',
            mrp: '',
            imageUrl: '',
            link: ''
          });
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCourse ? 'Edit Course' : 'Create New Course'}</h2>
              <button className="close-btn" onClick={() => {
                setIsModalOpen(false);
                setEditingCourse(null);
                setFormData({
                  title: '',
                  description: '',
                  instructor: '',
                  duration: '',
                  level: 'Beginner',
                  price: '',
                  mrp: '',
                  imageUrl: '',
                  link: ''
                });
              }}>
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
                  <label className="form-label">Price (₹)</label>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">
                    <span style={{ marginRight: '4px' }}>₹</span>
                    MRP (₹) - Optional
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    placeholder="Maximum Retail Price"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <FiImage style={{ display: 'inline', marginRight: '4px' }} />
                    Image URL - Optional
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <FiLink style={{ display: 'inline', marginRight: '4px' }} />
                  Course Link - Optional
                </label>
                <input
                  type="url"
                  className="form-input"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://example.com/course"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setIsModalOpen(false);
                  setEditingCourse(null);
                  setFormData({
                    title: '',
                    description: '',
                    instructor: '',
                    duration: '',
                    level: 'Beginner',
                    price: '',
                    mrp: '',
                    imageUrl: '',
                    link: ''
                  });
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCourse ? 'Update Course' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Course Modal */}
      <ViewCourseModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedCourse(null);
        }}
        course={selectedCourse}
        onEnroll={handleEnroll}
        onEdit={handleEdit}
      />
    </div>
  );
}

export default Courses;
