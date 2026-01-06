import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import CreatePostModal from '../components/CreatePostModal';
import CreateAnnouncementModal from '../components/CreateAnnouncementModal';
import AdminPasswordModal from '../components/AdminPasswordModal';
import { FiPlus, FiEdit, FiTrash2, FiX } from 'react-icons/fi';

function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalUsers: 0,
    totalComments: 0,
    activeUsers: 0
  });
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [states, setStates] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isStateModalOpen, setIsStateModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingState, setEditingState] = useState(null);
  const [editingChannel, setEditingChannel] = useState(null);
  const [newStateName, setNewStateName] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [selectedStateForChannel, setSelectedStateForChannel] = useState('');

  useEffect(() => {
    // Check if admin is authenticated
    const authStatus = sessionStorage.getItem('adminAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      
      // Check if user is superadmin
      const savedProfile = localStorage.getItem('userProfile');
    const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
    const DEFAULT_ADMIN_EMAIL = 'admin@ironlady.com'; // Default IronLady account
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          setIsSuperAdmin(
            profile.email === SUPERADMIN_EMAIL || 
            profile.username === 'ironlady' ||
            profile.email === DEFAULT_ADMIN_EMAIL ||
            profile.isSuperAdmin === true
          );
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      } else {
        // No profile = default IronLady account = super admin
        setIsSuperAdmin(true);
      }
    } else {
      setShowPasswordModal(true);
    }
  }, []);

  const handlePasswordSuccess = () => {
    setIsAuthenticated(true);
    setShowPasswordModal(false);
  };

  useEffect(() => {
    // Only fetch data if authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    // Fetch posts - limit to recent 50 for performance
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const postsUnsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
      // Get total count separately (optimized)
      getDocs(collection(db, 'posts')).then(totalSnapshot => {
        setStats(prev => ({ ...prev, totalPosts: totalSnapshot.size }));
      }).catch(err => console.error('Error getting total posts:', err));
    });

    // Fetch users - limit to 100 for performance
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const usersUnsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      // Get total count separately (optimized)
      getDocs(collection(db, 'users')).then(totalSnapshot => {
        setStats(prev => ({ ...prev, totalUsers: totalSnapshot.size }));
      }).catch(err => console.error('Error getting total users:', err));
    });

    // Fetch states
    const statesQuery = query(collection(db, 'states'));
    const statesUnsubscribe = onSnapshot(
      statesQuery, 
      (snapshot) => {
        const statesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('States fetched:', statesData);
        setStates(statesData);
      },
      (error) => {
        console.error('Error fetching states:', error);
        alert(`Error fetching states: ${error.message}`);
      }
    );

    // Fetch channels
    const channelsQuery = query(collection(db, 'channels'));
    const channelsUnsubscribe = onSnapshot(
      channelsQuery, 
      (snapshot) => {
        const channelsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Channels fetched:', channelsData);
        setChannels(channelsData);
      },
      (error) => {
        console.error('Error fetching channels:', error);
        alert(`Error fetching channels: ${error.message}`);
      }
    );

    setLoading(false);

    return () => {
      postsUnsubscribe();
      usersUnsubscribe();
      statesUnsubscribe();
      channelsUnsubscribe();
    };
  }, [isAuthenticated]);

  const handleDeletePost = async (postId, postAuthor) => {
    // Check if user is admin
    const savedProfile = localStorage.getItem('userProfile');
    let userIsAdmin = false;
    let userIsSuperAdmin = false;
    
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        userIsAdmin = profile.isAdmin || false;
        userIsSuperAdmin = profile.isSuperAdmin || 
                         profile.email === 'superadmin@gmail.com' || 
                         profile.username === 'ironlady' ||
                         profile.email === 'admin@ironlady.com';
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    } else {
      // No profile - not admin
      userIsAdmin = false;
      userIsSuperAdmin = false;
    }

    // Admins can delete any post (including admin posts)
    if (!userIsAdmin && !userIsSuperAdmin) {
      alert('Only admins can delete posts.');
      return;
    }

    const confirmMessage = postAuthor?.isAdmin 
      ? 'Are you sure you want to delete this admin post?'
      : 'Are you sure you want to delete this post?';
    
    if (window.confirm(confirmMessage)) {
      try {
        // Delete the post
        await deleteDoc(doc(db, 'posts', postId));
        
        // Also delete all comments for this post (optional cleanup)
        try {
          const commentsQuery = query(collection(db, 'posts', postId, 'comments'));
          const commentsSnapshot = await getDocs(commentsQuery);
          const deletePromises = commentsSnapshot.docs.map(commentDoc => 
            deleteDoc(doc(db, 'posts', postId, 'comments', commentDoc.id))
          );
          await Promise.all(deletePromises);
        } catch (commentsError) {
          console.log('Note: Could not delete comments (they may not exist):', commentsError);
          // Continue even if comments deletion fails
        }
        
        alert('Post deleted successfully!');
      } catch (error) {
        console.error('Error deleting post:', error);
        console.error('Error details:', error.message, error.code);
        alert(`Error deleting post: ${error.message || 'Please check console for details'}`);
      }
    }
  };

  const handleToggleAdmin = async (userId, currentStatus) => {
    // Only superadmin can make users admin
    if (!isSuperAdmin) {
      alert('Only Super Admin can promote users to Admin. Contact Super Admin for access.');
      return;
    }
    
    if (window.confirm(`Are you sure you want to ${currentStatus ? 'remove' : 'grant'} admin privileges?`)) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          isAdmin: !currentStatus,
          updatedAt: new Date()
        });
        
        // If the promoted user is the currently logged-in user, update their localStorage
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
          try {
            const profile = JSON.parse(savedProfile);
            if (profile.id === userId) {
              // Update the profile in localStorage
              profile.isAdmin = !currentStatus;
              localStorage.setItem('userProfile', JSON.stringify(profile));
              // Dispatch event to update other components
              window.dispatchEvent(new Event('profileUpdated'));
              alert(`You have been ${currentStatus ? 'removed from' : 'promoted to'} admin! Please refresh the page to see all channels.`);
            } else {
              alert(`User ${currentStatus ? 'removed from' : 'promoted to'} admin successfully!`);
            }
          } catch (error) {
            console.error('Error updating localStorage:', error);
            alert(`User ${currentStatus ? 'removed from' : 'promoted to'} admin successfully!`);
          }
        } else {
          alert(`User ${currentStatus ? 'removed from' : 'promoted to'} admin successfully!`);
        }
      } catch (error) {
        console.error('Error updating user:', error);
        alert('Error updating user');
      }
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    // Only superadmin can delete users
    if (!isSuperAdmin) {
      alert('Only Super Admin can delete users. Contact Super Admin for access.');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        alert('User deleted successfully!');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user. Please try again.');
      }
    }
  };

  const handleAddState = async (e) => {
    e.preventDefault();
    if (!newStateName.trim()) {
      alert('Please enter a state name');
      return;
    }

    try {
      if (editingState) {
        await updateDoc(doc(db, 'states', editingState.id), {
          name: newStateName.trim(),
          updatedAt: serverTimestamp()
        });
        alert('State updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, 'states'), {
          name: newStateName.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('State created with ID:', docRef.id);
        alert('State created successfully!');
      }
      setNewStateName('');
      setEditingState(null);
      setIsStateModalOpen(false);
    } catch (error) {
      console.error('Error adding/updating state:', error);
      console.error('Error details:', error.message, error.code);
      alert(`Error saving state: ${error.message || 'Please check console for details'}`);
    }
  };

  const handleAddChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) {
      alert('Please enter a channel name');
      return;
    }
    if (!selectedStateForChannel) {
      alert('Please select a state');
      return;
    }

    try {
      if (editingChannel) {
        await updateDoc(doc(db, 'channels', editingChannel.id), {
          name: newChannelName.trim(),
          stateId: selectedStateForChannel,
          updatedAt: serverTimestamp()
        });
        alert('Channel updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, 'channels'), {
          name: newChannelName.trim(),
          stateId: selectedStateForChannel,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('Channel created with ID:', docRef.id);
        alert('Channel created successfully!');
      }
      setNewChannelName('');
      setSelectedStateForChannel('');
      setEditingChannel(null);
      setIsChannelModalOpen(false);
    } catch (error) {
      console.error('Error adding/updating channel:', error);
      console.error('Error details:', error.message, error.code);
      alert(`Error saving channel: ${error.message || 'Please check console for details'}`);
    }
  };

  const handleEditState = (state) => {
    setEditingState(state);
    setNewStateName(state.name);
    setIsStateModalOpen(true);
  };

  const handleEditChannel = (channel) => {
    setEditingChannel(channel);
    setNewChannelName(channel.name);
    setSelectedStateForChannel(channel.stateId);
    setIsChannelModalOpen(true);
  };

  const handleDeleteState = async (stateId) => {
    if (window.confirm('Are you sure you want to delete this state? All channels under it will also be deleted.')) {
      try {
        // Delete all channels under this state
        const stateChannels = channels.filter(ch => ch.stateId === stateId);
        for (const channel of stateChannels) {
          await deleteDoc(doc(db, 'channels', channel.id));
        }
        // Delete the state
        await deleteDoc(doc(db, 'states', stateId));
      } catch (error) {
        console.error('Error deleting state:', error);
        alert('Error deleting state');
      }
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (window.confirm('Are you sure you want to delete this channel?')) {
      try {
        await deleteDoc(doc(db, 'channels', channelId));
      } catch (error) {
        console.error('Error deleting channel:', error);
        alert('Error deleting channel');
      }
    }
  };

  const getChannelsByState = (stateId) => {
    return channels.filter(ch => ch.stateId === stateId);
  };

  // Show password modal if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <AdminPasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            // Redirect to home if they close without entering password
            window.location.href = '/';
          }}
          onSuccess={handlePasswordSuccess}
        />
        <div className="admin-container">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2 style={{ color: '#6b7280' }}>Please enter admin password to continue</h2>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return <div className="admin-container">Loading...</div>;
  }

  // Get display info - use default IronLady if no profile
  const savedProfile = localStorage.getItem('userProfile');
  let displayName = 'IronLady';
  let displayEmail = 'admin@ironlady.com';
  
  if (savedProfile) {
    try {
      const profile = JSON.parse(savedProfile);
      displayName = profile.name || 'IronLady';
      displayEmail = profile.email || 'admin@ironlady.com';
    } catch (error) {
      console.error('Error parsing profile:', error);
    }
  }

  return (
    <div className="admin-container">
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-title">Admin Dashboard</h1>
          <p style={{ color: '#6b7280' }}>Welcome, {displayName} - Manage your community</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: savedProfile ? 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: savedProfile ? 'none' : '2px solid #6b46c1'
          }}>
            {savedProfile ? (
              <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
                {displayName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <img 
                src="/logo.png" 
                alt="Iron Lady" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                  padding: '5px'
                }} 
              />
            )}
          </div>
        </div>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.totalPosts}</div>
          <div className="stat-label">Total Posts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{states.length}</div>
          <div className="stat-label">States</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{channels.length}</div>
          <div className="stat-label">Channels</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-section">
        <h2 className="section-title">Quick Actions</h2>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsAnnouncementModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              fontWeight: 600
            }}
          >
            📢 Create Announcement
          </button>
          <button className="btn btn-primary" onClick={() => setIsPostModalOpen(true)}>
            <FiPlus style={{ marginRight: '8px' }} />
            Create Post
          </button>
          <button className="btn btn-primary" onClick={() => {
            setEditingState(null);
            setNewStateName('');
            setIsStateModalOpen(true);
          }}>
            <FiPlus style={{ marginRight: '8px' }} />
            Add State
          </button>
          <button className="btn btn-primary" onClick={() => {
            setEditingChannel(null);
            setNewChannelName('');
            setSelectedStateForChannel('');
            setIsChannelModalOpen(true);
          }}>
            <FiPlus style={{ marginRight: '8px' }} />
            Add Channel
          </button>
        </div>
      </div>

      {/* States Management */}
      <div className="admin-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 className="section-title">States</h2>
        </div>
        {states.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>No states yet. Add your first state!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {states.map((state) => (
              <div key={state.id} className="stat-card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>{state.name}</h3>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      className="action-btn btn-edit"
                      onClick={() => handleEditState(state)}
                      style={{ padding: '6px 10px' }}
                    >
                      <FiEdit />
                    </button>
                    <button
                      className="action-btn btn-delete"
                      onClick={() => handleDeleteState(state.id)}
                      style={{ padding: '6px 10px' }}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '10px' }}>
                  Channels: {getChannelsByState(state.id).length}
                </div>
                {getChannelsByState(state.id).length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                    {getChannelsByState(state.id).map((channel) => (
                      <div key={channel.id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '5px 0',
                        fontSize: '14px'
                      }}>
                        <span style={{ color: '#374151' }}>• {channel.name}</span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            className="action-btn btn-edit"
                            onClick={() => handleEditChannel(channel)}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            <FiEdit />
                          </button>
                          <button
                            className="action-btn btn-delete"
                            onClick={() => handleDeleteChannel(channel.id)}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Channels Management */}
      <div className="admin-section">
        <h2 className="section-title">All Channels</h2>
        {channels.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>No channels yet. Add your first channel!</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Channel Name</th>
                  <th>State</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((channel) => {
                  const state = states.find(s => s.id === channel.stateId);
                  return (
                    <tr key={channel.id}>
                      <td>{channel.name}</td>
                      <td>{state?.name || 'N/A'}</td>
                      <td>
                        {channel.createdAt?.toDate
                          ? channel.createdAt.toDate().toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td>
                        <button
                          className="action-btn btn-edit"
                          onClick={() => handleEditChannel(channel)}
                        >
                          Edit
                        </button>
                        <button
                          className="action-btn btn-delete"
                          onClick={() => handleDeleteChannel(channel.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Posts */}
      <div className="admin-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 className="section-title">Recent Posts (Showing {posts.length} of {stats.totalPosts})</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Content</th>
                <th>Category</th>
                <th>Likes</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.author?.name || 'Unknown'}</td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {post.content?.substring(0, 50)}...
                  </td>
                  <td>{post.category || 'N/A'}</td>
                  <td>{post.likes || 0}</td>
                  <td>
                    {post.createdAt?.toDate
                      ? post.createdAt.toDate().toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td>
                    <button
                      className="action-btn btn-delete"
                      onClick={() => handleDeletePost(post.id, post.author)}
                      title={post.author?.isAdmin ? 'Delete admin post' : 'Delete post'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Management */}
      <div className="admin-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 className="section-title">Users (Showing {users.length} of {stats.totalUsers})</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>State</th>
                <th>Admin</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((userData) => (
                <tr key={userData.id}>
                  <td>{userData.name || 'N/A'}</td>
                  <td>{userData.email || 'N/A'}</td>
                  <td>{userData.state ? states.find(s => s.id === userData.state)?.name || userData.state : 'N/A'}</td>
                  <td>
                    {userData.isAdmin ? (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>Yes</span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>No</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {isSuperAdmin ? (
                        <>
                          <button
                            className="action-btn btn-edit"
                            onClick={() => handleToggleAdmin(userData.id, userData.isAdmin)}
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            {userData.isAdmin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                          <button
                            className="action-btn btn-delete"
                            onClick={() => handleDeleteUser(userData.id, userData.name || userData.email)}
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                            title="Delete User"
                          >
                            <FiTrash2 style={{ fontSize: '14px' }} />
                          </button>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>Super Admin Only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <CreateAnnouncementModal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        user={user}
      />
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        user={user}
      />

      {/* Add/Edit State Modal */}
      {isStateModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsStateModalOpen(false);
          setEditingState(null);
          setNewStateName('');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingState ? 'Edit State' : 'Add New State'}</h2>
              <button className="close-btn" onClick={() => {
                setIsStateModalOpen(false);
                setEditingState(null);
                setNewStateName('');
              }}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleAddState}>
              <div className="form-group">
                <label className="form-label">State Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newStateName}
                  onChange={(e) => setNewStateName(e.target.value)}
                  placeholder="e.g., Bangalore, Mumbai, Delhi"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setIsStateModalOpen(false);
                  setEditingState(null);
                  setNewStateName('');
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingState ? 'Update' : 'Add'} State
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Channel Modal */}
      {isChannelModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsChannelModalOpen(false);
          setEditingChannel(null);
          setNewChannelName('');
          setSelectedStateForChannel('');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingChannel ? 'Edit Channel' : 'Add New Channel'}</h2>
              <button className="close-btn" onClick={() => {
                setIsChannelModalOpen(false);
                setEditingChannel(null);
                setNewChannelName('');
                setSelectedStateForChannel('');
              }}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleAddChannel}>
              <div className="form-group">
                <label className="form-label">Select State</label>
                <select
                  className="form-select"
                  value={selectedStateForChannel}
                  onChange={(e) => setSelectedStateForChannel(e.target.value)}
                  required
                >
                  <option value="">Choose a state...</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>{state.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Channel Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g., Health & Wellness, General, Tech"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setIsChannelModalOpen(false);
                  setEditingChannel(null);
                  setNewChannelName('');
                  setSelectedStateForChannel('');
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingChannel ? 'Update' : 'Add'} Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
