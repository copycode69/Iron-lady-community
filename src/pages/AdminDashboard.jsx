import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import CreatePostModal from '../components/CreatePostModal';
import CreateAnnouncementModal from '../components/CreateAnnouncementModal';
import AdminPasswordModal from '../components/AdminPasswordModal';
import { FiPlus, FiEdit, FiTrash2, FiX } from 'react-icons/fi';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
    console.log('AdminDashboard - Checking authentication...');
    // Check if admin is authenticated via sessionStorage OR if user is superadmin
    const authStatus = sessionStorage.getItem('adminAuthenticated');
    const savedProfile = localStorage.getItem('userProfile');
    const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
    
    console.log('AdminDashboard - Auth check:', {
      authStatus,
      hasProfile: !!savedProfile
    });
    
    // Check if user is superadmin from localStorage
    let isSuperAdminUser = false;
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        // Only superadmin@gmail.com with username ironlady is superadmin
        isSuperAdminUser = (profile.email === SUPERADMIN_EMAIL && profile.username === 'ironlady') || 
                          profile.username === 'ironlady' ||
                          profile.isSuperAdmin === true;
        setIsSuperAdmin(isSuperAdminUser);
        console.log('AdminDashboard - Profile parsed:', {
          email: profile.email,
          username: profile.username,
          isSuperAdmin: isSuperAdminUser
        });
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    }
    
    // If authenticated via sessionStorage OR if superadmin, allow access
    if (authStatus === 'true' || isSuperAdminUser) {
      console.log('AdminDashboard - Authentication successful, setting isAuthenticated to true');
      // Use a callback to ensure state is updated before next render
      setIsAuthenticated(true);
      // If superadmin but not in sessionStorage, set it
      if (isSuperAdminUser && authStatus !== 'true') {
        sessionStorage.setItem('adminAuthenticated', 'true');
        console.log('AdminDashboard - Set adminAuthenticated in sessionStorage');
      }
    } else {
      console.log('AdminDashboard - Not authenticated, showing password modal');
      // Not authenticated and not superadmin - show password modal
      setShowPasswordModal(true);
    }
  }, []);

  const handlePasswordSuccess = () => {
    setIsAuthenticated(true);
    setShowPasswordModal(false);
  };

  useEffect(() => {
    // Check authentication status directly from storage to avoid race condition
    const authStatus = sessionStorage.getItem('adminAuthenticated');
    const savedProfile = localStorage.getItem('userProfile');
    const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
    
    let isSuperAdminUser = false;
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        isSuperAdminUser = (profile.email === SUPERADMIN_EMAIL && profile.username === 'ironlady') || 
                          profile.username === 'ironlady' ||
                          profile.isSuperAdmin === true;
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    }
    
    const isActuallyAuthenticated = authStatus === 'true' || isSuperAdminUser;
    
    console.log('AdminDashboard - Data fetch useEffect, isAuthenticated:', isAuthenticated, 'isActuallyAuthenticated:', isActuallyAuthenticated);
    
    // Only fetch data if authenticated
    if (!isActuallyAuthenticated && !isAuthenticated) {
      console.log('AdminDashboard - Not authenticated, skipping data fetch');
      setLoading(false);
      return;
    }
    
    // If we're authenticated but state hasn't updated yet, set it immediately
    if (isActuallyAuthenticated && !isAuthenticated) {
      console.log('AdminDashboard - Authenticated but state not updated, setting immediately...');
      setIsAuthenticated(true);
      // Continue with data fetch
    }

    // Only proceed if actually authenticated
    if (!isActuallyAuthenticated) {
      console.log('AdminDashboard - Not actually authenticated, skipping data fetch');
      setLoading(false);
      return;
    }

    console.log('AdminDashboard - Starting to fetch data from Firestore...');
    // Fetch posts - limit to recent 50 for performance
    let postsUnsubscribe;
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      postsUnsubscribe = onSnapshot(
        postsQuery, 
        (snapshot) => {
          const postsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log('AdminDashboard - Posts fetched:', postsData.length);
          setPosts(postsData);
          // Get total count separately (optimized)
          getDocs(collection(db, 'posts')).then(totalSnapshot => {
            setStats(prev => ({ ...prev, totalPosts: totalSnapshot.size }));
          }).catch(err => console.error('Error getting total posts:', err));
        },
        (error) => {
          console.error('AdminDashboard - Error fetching posts with orderBy, trying fallback:', error);
          // Fallback: Get posts without ordering
          const fallbackQuery = query(collection(db, 'posts'), limit(50));
          onSnapshot(fallbackQuery, (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            // Sort manually by createdAt
            postsData.sort((a, b) => {
              const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
              const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
              return dateB - dateA;
            });
            console.log('AdminDashboard - Posts fetched (fallback):', postsData.length);
            setPosts(postsData);
          });
        }
      );
    } catch (error) {
      console.error('AdminDashboard - Error setting up posts query:', error);
      setPosts([]);
    }

    // Fetch users - limit to 100 for performance
    let usersUnsubscribe;
    try {
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      usersUnsubscribe = onSnapshot(
        usersQuery, 
        (snapshot) => {
          const usersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log('AdminDashboard - Users fetched:', usersData.length);
          setUsers(usersData);
          // Get total count separately (optimized)
          getDocs(collection(db, 'users')).then(totalSnapshot => {
            setStats(prev => ({ ...prev, totalUsers: totalSnapshot.size }));
          }).catch(err => console.error('Error getting total users:', err));
        },
        (error) => {
          console.error('AdminDashboard - Error fetching users with orderBy, trying fallback:', error);
          // Fallback: Get users without ordering
          const fallbackQuery = query(collection(db, 'users'), limit(100));
          onSnapshot(fallbackQuery, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            // Sort manually by createdAt
            usersData.sort((a, b) => {
              const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
              const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
              return dateB - dateA;
            });
            console.log('AdminDashboard - Users fetched (fallback):', usersData.length);
            setUsers(usersData);
          });
        }
      );
    } catch (error) {
      console.error('AdminDashboard - Error setting up users query:', error);
      setUsers([]);
    }

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

    // Set loading to false after a short delay to ensure data is loaded
    const loadingTimeout = setTimeout(() => {
      console.log('AdminDashboard - Data fetch complete, setting loading to false');
      setLoading(false);
    }, 2000);

    return () => {
      clearTimeout(loadingTimeout);
      if (postsUnsubscribe && typeof postsUnsubscribe === 'function') postsUnsubscribe();
      if (usersUnsubscribe && typeof usersUnsubscribe === 'function') usersUnsubscribe();
      if (statesUnsubscribe && typeof statesUnsubscribe === 'function') statesUnsubscribe();
      if (channelsUnsubscribe && typeof channelsUnsubscribe === 'function') channelsUnsubscribe();
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
                         (profile.email === 'superadmin@gmail.com' && profile.username === 'ironlady');
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

  // Calculate chart data using useMemo for performance (must be before conditional returns)
  const pieChartData = useMemo(() => {
    const categoryCount = {};
    posts.forEach(post => {
      const category = post.category || post.channelName || 'General';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    const data = Object.entries(categoryCount).map(([name, value]) => ({ name, value }));
    return data.length > 0 ? data : [{ name: 'No Data', value: 1 }];
  }, [posts]);

  const pieChartColors = useMemo(() => {
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'];
    return colors;
  }, []);

  const postsByStateData = useMemo(() => {
    const stateCount = {};
    posts.forEach(post => {
      const stateName = post.stateName || 'Announcements';
      stateCount[stateName] = (stateCount[stateName] || 0) + 1;
    });
    const data = Object.entries(stateCount)
      .map(([name, value]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return data.length > 0 ? data : [{ name: 'No Data', value: 0 }];
  }, [posts]);

  const usersByStateData = useMemo(() => {
    const stateCount = {};
    users.forEach(user => {
      const stateId = user.state;
      const stateName = stateId ? (states.find(s => s.id === stateId)?.name || 'Unknown') : 'No State';
      stateCount[stateName] = (stateCount[stateName] || 0) + 1;
    });
    const data = Object.entries(stateCount)
      .map(([name, value]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return data.length > 0 ? data : [{ name: 'No Data', value: 0 }];
  }, [users, states]);

  const postsOverTimeData = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({ name: dateStr, value: 0 });
    }
    
    posts.forEach(post => {
      if (post.createdAt) {
        const postDate = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
        const daysAgo = Math.floor((today - postDate) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 0 && daysAgo <= 6) {
          const dayIndex = 6 - daysAgo;
          if (days[dayIndex]) {
            days[dayIndex].value += 1;
          }
        }
      }
    });
    
    return days;
  }, [posts]);

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
    console.log('AdminDashboard - Still loading, showing loading screen');
    return (
      <div className="admin-container" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '10px' }}>Loading admin dashboard...</div>
        <div style={{ fontSize: '14px', color: '#9ca3af' }}>
          Fetching data from Firestore...
        </div>
        <div style={{ fontSize: '12px', color: '#d1d5db', marginTop: '10px' }}>
          Debug: isAuthenticated={isAuthenticated.toString()}, loading={loading.toString()}
        </div>
      </div>
    );
  }
  
  console.log('AdminDashboard - Rendering dashboard content');

  // Get display info - use default IronLady if no profile
  const savedProfile = localStorage.getItem('userProfile');
  let displayName = 'IronLady';
  let displayEmail = 'superadmin@gmail.com';
  
  if (savedProfile) {
    try {
      const profile = JSON.parse(savedProfile);
      displayName = profile.name || 'IronLady';
      displayEmail = profile.email || 'superadmin@gmail.com';
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

      {/* Analytics Charts */}
      <div className="admin-section">
        <h2 className="section-title">Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {/* Pie Chart - Posts by Category */}
          <div className="stat-card" style={{ padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '20px', textAlign: 'center' }}>
              Posts by Category
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={pieChartColors[index % pieChartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart - Posts by State */}
          <div className="stat-card" style={{ padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '20px', textAlign: 'center' }}>
              Posts by State
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={postsByStateData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  style={{ fontSize: '12px' }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Posts" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart - Users by State */}
          <div className="stat-card" style={{ padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '20px', textAlign: 'center' }}>
              Users by State
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={usersByStateData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  style={{ fontSize: '12px' }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#82ca9d" name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart - Posts Over Time (Last 7 Days) */}
          <div className="stat-card" style={{ padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '20px', textAlign: 'center' }}>
              Posts Over Time (Last 7 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={postsOverTimeData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#ffc658" name="Posts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
      />
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
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
