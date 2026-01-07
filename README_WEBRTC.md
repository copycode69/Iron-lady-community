# WebRTC Live Video Streaming Implementation Guide

This document explains how the WebRTC live video streaming feature is implemented in the Iron Lady Community application.

## Overview

The live video streaming feature allows admins to start a live video stream, and all users can join to participate in a real-time video call. The implementation uses WebRTC (Web Real-Time Communication) for peer-to-peer video connections and Firebase Firestore for signaling.

## Architecture

### Components

1. **LiveStreamModal.jsx** - Main component handling video streaming
2. **Sidebar.jsx** - Contains the "Go Live" button for admins
3. **LiveBanner.jsx** - Displays live stream notification to users
4. **Firebase Firestore** - Used for signaling (SDP offers/answers, ICE candidates)

### Technology Stack

- **WebRTC API** - For peer-to-peer video/audio connections
- **Firebase Firestore** - For signaling between peers
- **getUserMedia API** - For accessing camera and microphone
- **RTCPeerConnection** - Core WebRTC API for managing connections

## How It Works

### 1. Admin Starts Live Stream

```
Admin clicks "Go Live" → LiveStreamModal opens → Admin grants camera/mic permissions → 
Stream starts → Firebase status updated → Users see live banner
```

**Code Flow:**
```javascript
startLiveStream() {
  1. Request camera/microphone access via getUserMedia()
  2. Set local video stream
  3. Update Firebase liveStatus document
  4. Start listening for participants joining
}
```

### 2. User Joins Live Stream

```
User sees live banner → Clicks to join → LiveStreamModal opens → User grants permissions → 
Sends join signal to Firebase → Admin receives signal → Peer connection established
```

**Code Flow:**
```javascript
joinLiveStream() {
  1. Request camera/microphone access
  2. Send join signal to Firebase
  3. Listen for admin's WebRTC offer
  4. Create answer and establish connection
}
```

### 3. WebRTC Connection Process

The WebRTC connection follows this standard flow:

```
1. Create RTCPeerConnection
2. Add local media tracks
3. Create offer (admin) or wait for offer (user)
4. Exchange SDP (Session Description Protocol) via Firebase
5. Exchange ICE candidates via Firebase
6. Connection established → Video/audio streams
```

## Implementation Details

### Firebase Firestore Structure

#### Collection: `liveSignaling`

Documents contain signaling messages:

```javascript
{
  type: 'join' | 'offer' | 'answer' | 'ice-candidate',
  userId: 'user-id',
  targetUserId: 'target-user-id',
  offer: RTCSessionDescription,  // For offers
  answer: RTCSessionDescription,  // For answers
  candidate: RTCIceCandidate,     // For ICE candidates
  timestamp: serverTimestamp()
}
```

#### Document: `system/liveStatus`

```javascript
{
  isLive: boolean,
  adminName: string,
  message: string,
  startedAt: timestamp,
  stoppedAt: timestamp
}
```

### WebRTC Configuration

```javascript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
```

**Note:** For production, you may want to add TURN servers for users behind strict NATs.

### Key Functions

#### 1. Creating Peer Connection

```javascript
const createPeerConnection = async (userId, isInitiator) => {
  // Create RTCPeerConnection with STUN servers
  const pc = new RTCPeerConnection(configuration);
  
  // Add local stream tracks
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });
  
  // Handle incoming remote stream
  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];
    // Display remote video
  };
  
  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      // Send to Firebase for signaling
    }
  };
  
  // Create offer if initiator
  if (isInitiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // Send offer via Firebase
  }
};
```

#### 2. Handling Offers and Answers

```javascript
// Admin sends offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
// Save to Firebase

// User receives offer
await pc.setRemoteDescription(new RTCSessionDescription(offer));
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
// Save answer to Firebase

// Admin receives answer
await pc.setRemoteDescription(new RTCSessionDescription(answer));
```

#### 3. Handling ICE Candidates

```javascript
// When ICE candidate is generated
pc.onicecandidate = async (event) => {
  if (event.candidate) {
    await addDoc(collection(db, 'liveSignaling'), {
      type: 'ice-candidate',
      candidate: event.candidate,
      userId: currentUserId,
      targetUserId: targetUserId
    });
  }
};

// When receiving ICE candidate
const handleIceCandidate = async (data) => {
  const pc = peerConnectionsRef.current[data.targetUserId];
  if (pc && data.candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
};
```

## Setup Instructions

### 1. Firebase Configuration

Ensure your Firebase project is set up with Firestore enabled:

```javascript
// firebase/config.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase config
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

### 2. Firestore Security Rules

Add these rules to allow signaling:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Live signaling collection
    match /liveSignaling/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Live status document
    match /system/liveStatus {
      allow read: if true;  // Anyone can read
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

### 3. Browser Permissions

The application will request camera and microphone permissions. Ensure your site is served over HTTPS (required for getUserMedia in production).

For local development, you can use:
- `localhost` (works without HTTPS)
- `https://localhost` (self-signed certificate)

### 4. Environment Setup

No additional packages are required. The implementation uses:
- Native WebRTC APIs (built into modern browsers)
- Firebase SDK (already installed)
- React (already installed)

## Usage

### For Admins

1. Click the "Go live" button in the sidebar
2. Grant camera and microphone permissions when prompted
3. Click "Start Live Stream" in the modal
4. Your video will be visible to all users
5. Click "Stop Live" to end the stream

### For Users

1. When admin goes live, a banner appears at the top
2. Click the banner to join the live stream
3. Grant camera and microphone permissions
4. Your video will be visible to admin and other participants
5. Use the controls to toggle video/audio on/off

## Features

### ✅ Implemented

- Admin can start/stop live streams
- Users can join live streams
- Real-time video and audio transmission
- Toggle video/audio controls
- Participant count display
- Multiple participants support
- WebRTC peer-to-peer connections
- Firebase signaling

### 🔄 Future Enhancements

- Screen sharing
- Chat during live stream
- Recording live streams
- Better error handling and reconnection
- TURN server for better connectivity
- Bandwidth adaptation
- Mute individual participants (admin only)

## Troubleshooting

### Camera/Microphone Not Working

1. Check browser permissions in settings
2. Ensure site is served over HTTPS (or localhost)
3. Check if other applications are using the camera/mic
4. Verify browser supports WebRTC (Chrome, Firefox, Safari, Edge)

### Connection Issues

1. Check Firebase connection
2. Verify Firestore rules allow read/write
3. Check browser console for errors
4. Ensure STUN servers are accessible

### Video Not Displaying

1. Check if stream is properly set: `video.srcObject = stream`
2. Verify video element has `autoPlay` attribute
3. Check browser console for WebRTC errors
4. Ensure peer connection is established

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 60+ | ✅ Full Support |
| Firefox | 55+ | ✅ Full Support |
| Safari | 11+ | ✅ Full Support |
| Edge | 79+ | ✅ Full Support |
| Opera | 47+ | ✅ Full Support |

## Security Considerations

1. **HTTPS Required**: WebRTC requires HTTPS in production
2. **Permissions**: Users must explicitly grant camera/mic access
3. **Firestore Rules**: Properly configure security rules
4. **User Validation**: Verify admin status before allowing stream control
5. **Signal Validation**: Validate signaling messages before processing

## Performance Optimization

1. **Limit Participants**: Consider limiting concurrent participants
2. **Bandwidth Management**: Adjust video quality based on connection
3. **Cleanup**: Properly close peer connections when leaving
4. **Resource Management**: Stop media tracks when not in use

## Code Structure

```
src/
├── components/
│   ├── LiveStreamModal.jsx    # Main video streaming component
│   ├── LiveBanner.jsx          # Live stream notification banner
│   └── Sidebar.jsx              # Go Live button
├── firebase/
│   └── config.js               # Firebase configuration
└── README_WEBRTC.md            # This file
```

## Additional Resources

- [WebRTC MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [RTCPeerConnection API](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)

## Support

For issues or questions:
1. Check browser console for errors
2. Verify Firebase configuration
3. Test with different browsers
4. Check network connectivity
5. Review Firestore security rules

---

**Last Updated:** 2024
**Version:** 1.0.0

