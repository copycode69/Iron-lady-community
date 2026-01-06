import { useState, useEffect, useCallback } from 'react';
import { collection, query, limit, startAfter, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiChevronDown } from 'react-icons/fi';

function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastMember, setLastMember] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userStateId, setUserStateId] = useState(null);
  const [states, setStates] = useState([]);
  const MEMBERS_PER_PAGE = 30;

  // Fetch states to get state names for display
  useEffect(() => {
    const statesQuery = query(collection(db, 'states'));
    const statesUnsubscribe = onSnapshot(
      statesQuery,
      (snapshot) => {
        const statesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStates(statesData);
      },
      (error) => {
        console.error('Error fetching states:', error);
      }
    );

    return () => statesUnsubscribe();
  }, []);

  // Check if user is admin and get their state
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
        setUserStateId(profile.state || null);
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
      } else {
        // No profile - not admin
        setIsAdmin(false);
        setUserStateId(null);
      }
  }, []);

  const loadMembers = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Get user's state for filtering
      const savedProfile = localStorage.getItem('userProfile');
      let currentUserStateId = null;
      let isUserAdmin = false;
      const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          currentUserStateId = profile.state || null;
          isUserAdmin = profile.isAdmin || 
                       profile.isSuperAdmin || 
                       profile.email === SUPERADMIN_EMAIL;
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      } else {
        isUserAdmin = false; // No profile - not admin
      }

      let q = query(
        collection(db, 'users'),
        orderBy('name'),
        limit(MEMBERS_PER_PAGE * 2) // Get more to filter
      );

      if (!isInitial && lastMember) {
        q = query(q, startAfter(lastMember));
      }

      const snapshot = await getDocs(q);
      let membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter by state: regular users only see members from their state
      if (!isUserAdmin && currentUserStateId) {
        membersData = membersData.filter(member => {
          // Member must have a state and it must match user's state
          return member.state && member.state === currentUserStateId;
        });
        console.log(`Filtered members for state: ${currentUserStateId}, showing ${membersData.length} members`);
      } else if (!isUserAdmin && !currentUserStateId) {
        // User has no state - show no members
        membersData = [];
        console.log('User has no state assigned - showing no members');
      } else {
        // Admin sees all members
        console.log('Admin user - showing all members');
      }

      // Limit to MEMBERS_PER_PAGE after filtering
      membersData = membersData.slice(0, MEMBERS_PER_PAGE);

      if (isInitial) {
        setMembers(membersData);
      } else {
        setMembers(prev => [...prev, ...membersData]);
      }

      if (snapshot.docs.length < MEMBERS_PER_PAGE) {
        setHasMore(false);
      } else {
        setLastMember(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(true);
      }

      setLoading(false);
      setLoadingMore(false);
    } catch (error) {
      console.error('Error loading members:', error);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lastMember]);

  useEffect(() => {
    loadMembers(true);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadMembers(false);
    }
  };

  const filteredMembers = members.filter(member => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      member.name?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading members...</div>;
  }

  return (
    <div>
      <div className="feed-header">
        <h1 className="feed-title">Members</h1>
        <div className="feed-controls">
          <div className="search-bar" style={{ width: '300px' }}>
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>
        {isAdmin ? (
          <>Showing {filteredMembers.length} of {members.length} members (All states){hasMore && ` (${members.length}+ total)`}</>
        ) : userStateId ? (
          <>Showing {filteredMembers.length} members from your state{hasMore && ` (${members.length}+ total)`}</>
        ) : (
          <>No state assigned - Please set your state in profile to see members</>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {filteredMembers.map((member) => (
          <div key={member.id} className="stat-card">
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '5px' }}>
                {member.name || 'Unknown'}
              </div>
              {member.isAdmin && <span className="admin-badge">Admin</span>}
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>{member.email}</div>
            {member.state && (
              <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '5px', fontWeight: 600 }}>
                📍 State: {states.find(s => s.id === member.state)?.name || member.state || 'N/A'}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredMembers.length === 0 && searchTerm && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          No members found matching "{searchTerm}"
        </div>
      )}

      {hasMore && !searchTerm && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <button 
            className="btn btn-primary"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More Members'}
          </button>
        </div>
      )}

      {!hasMore && members.length > 0 && !searchTerm && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
          {isAdmin 
            ? `All members loaded (${members.length} total from all states)`
            : `All members from your state loaded (${members.length} total)`}
        </div>
      )}
      
      {!isAdmin && !userStateId && members.length === 0 && !loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#6b7280',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ color: '#1f2937', marginBottom: '10px' }}>No State Assigned</h3>
          <p style={{ marginBottom: '20px' }}>Please set your state in your profile to see members from your state.</p>
        </div>
      )}
    </div>
  );
}

export default Members;
