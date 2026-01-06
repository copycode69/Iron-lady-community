import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Feed from './pages/Feed';
import Courses from './pages/Courses';
import Events from './pages/Events';
import Members from './pages/Members';
import Leaderboard from './pages/Leaderboard';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import UserProfile from './pages/UserProfile';
import SavedPosts from './pages/SavedPosts';
import Login from './pages/Login';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<UserProfile />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/feed" element={
          <Layout>
            <ProtectedRoute>
              <Feed />
            </ProtectedRoute>
          </Layout>
        } />
        <Route path="/dashboard" element={
          <Layout>
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          </Layout>
        } />
        <Route path="/courses" element={
          <Layout>
            <ProtectedRoute>
              <Courses />
            </ProtectedRoute>
          </Layout>
        } />
        <Route path="/events" element={
          <Layout>
            <ProtectedRoute>
              <Events />
            </ProtectedRoute>
          </Layout>
        } />
        <Route path="/members" element={
          <Layout>
            <ProtectedRoute>
              <Members />
            </ProtectedRoute>
          </Layout>
        } />
        <Route path="/leaderboard" element={
          <Layout>
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          </Layout>
        } />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/saved" element={
          <Layout>
            <ProtectedRoute>
              <SavedPosts />
            </ProtectedRoute>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;

