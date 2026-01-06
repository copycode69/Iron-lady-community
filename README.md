# Iron Lady's Community Platform

A modern community platform built with React and Firebase, featuring a feed, admin dashboard, and user management.

## Features

- 🔐 Firebase Authentication (Email/Password)
- 📝 Post creation with images
- 💬 Real-time feed updates
- 👥 User management
- 🏆 Leaderboard
- 👨‍💼 Admin dashboard
- 📱 Responsive design
- 🎨 Modern UI matching the design

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password provider
4. Create a Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)
5. Enable Storage:
   - Go to Storage
   - Get started with default rules
6. Get your Firebase config:
   - Go to Project Settings > General
   - Scroll down to "Your apps"
   - Click on the web icon (</>) to add a web app
   - Copy the Firebase configuration object

### 3. Configure Firebase

Open `src/firebase/config.js` and replace the placeholder values with your actual Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 4. Firestore Security Rules

Update your Firestore security rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Posts collection
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid == resource.data.author.uid;
      allow delete: if request.auth != null && 
        (request.auth.uid == resource.data.author.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true);
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true);
    }
  }
}
```

### 5. Storage Security Rules

Update your Storage security rules in Firebase Console:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 6. Run the Application

```bash
npm run dev
```

The application will open at `http://localhost:3000`

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Layout.jsx
│   ├── Sidebar.jsx
│   ├── TopNav.jsx
│   ├── PostCard.jsx
│   ├── CreatePostModal.jsx
│   ├── AlertBanner.jsx
│   └── HelpButton.jsx
├── pages/              # Page components
│   ├── Feed.jsx
│   ├── Login.jsx
│   ├── AdminDashboard.jsx
│   ├── Courses.jsx
│   ├── Events.jsx
│   ├── Members.jsx
│   └── Leaderboard.jsx
├── firebase/           # Firebase configuration
│   └── config.js
├── App.jsx             # Main app component
├── App.css             # Global styles
└── main.jsx            # Entry point
```

## Admin Access

To make a user an admin:
1. Sign in to the application
2. Go to the Admin dashboard
3. Find the user in the Users table
4. Click "Make Admin" button

Alternatively, you can manually set `isAdmin: true` in the Firestore `users` collection.

## Features Overview

### Feed
- View all community posts
- Create new posts with text and images
- Like and comment on posts
- Filter by category

### Admin Dashboard
- View statistics (posts, users, comments)
- Manage posts (delete)
- Manage users (grant/revoke admin access)
- View recent activity

### Members
- Browse all community members
- See member profiles

### Leaderboard
- View top community members
- Points-based ranking system

## Technologies Used

- React 18
- React Router DOM
- Firebase (Authentication, Firestore, Storage)
- Vite
- React Icons
- date-fns

## License

MIT

