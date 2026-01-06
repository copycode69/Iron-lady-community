import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        points: Math.floor(Math.random() * 1000) // Placeholder - replace with actual points system
      }));
      // Sort by points
      usersData.sort((a, b) => (b.points || 0) - (a.points || 0));
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading leaderboard...</div>;
  }

  return (
    <div>
      <h1 className="feed-title">Leaderboard</h1>
      <div className="admin-section" style={{ marginTop: '20px' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Member</th>
              <th>Points</th>
              <th>Badge</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.id}>
                <td style={{ fontWeight: 600, color: index < 3 ? '#6b46c1' : '#374151' }}>
                  #{index + 1}
                </td>
                <td>
                  <div>
                    <div style={{ fontWeight: 500 }}>{user.name || 'Unknown'}</div>
                    {user.isAdmin && <span className="admin-badge">Admin</span>}
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{user.points || 0}</td>
                <td>
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Leaderboard;

