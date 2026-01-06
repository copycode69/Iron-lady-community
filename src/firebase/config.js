import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDO28wiAE7WP1Pgepa3XSM68SFROb1Z608",
  authDomain: "community-83964.firebaseapp.com",
  projectId: "community-83964",
  storageBucket: "community-83964.firebasestorage.app",
  messagingSenderId: "1034531489324",
  appId: "1:1034531489324:web:d2d73d7b258cbf2109f389",
  measurementId: "G-C4N46WVB6D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('Analytics initialization failed:', error);
  }
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { analytics };

export default app;

