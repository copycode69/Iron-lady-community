import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiX, FiVideo, FiVideoOff, FiMic, FiMicOff, FiUsers } from 'react-icons/fi';

function LiveStreamModal({ isOpen, onClose, isAdmin, onStopLive }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [isLive, setIsLive] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const signalingUnsubscribeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when modal closes
      stopAllStreams();
      return;
    }

    // Check live status
    const liveStatusRef = doc(db, 'system', 'liveStatus');
    const liveUnsubscribe = onSnapshot(liveStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsLive(data.isLive || false);
      } else {
        setIsLive(false);
      }
    });

    // Listen for signaling messages if admin
    if (isAdmin && isLive) {
      listenForSignaling();
    } else if (!isAdmin && isLive) {
      // User joins the live stream
      joinLiveStream();
    }

    return () => {
      liveUnsubscribe();
      if (signalingUnsubscribeRef.current) {
        signalingUnsubscribeRef.current();
      }
      stopAllStreams();
    };
  }, [isOpen, isAdmin, isLive]);

  const startLiveStream = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Update live status
      const liveStatusRef = doc(db, 'system', 'liveStatus');
      await updateDoc(liveStatusRef, {
        isLive: true,
        startedAt: new Date()
      });

      // Start listening for participants
      listenForParticipants();
    } catch (error) {
      console.error('Error starting live stream:', error);
      alert('Error accessing camera/microphone. Please check permissions.');
    }
  };

  const stopAllStreams = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => {
      pc.close();
    });
    peerConnectionsRef.current = {};

    // Clear remote streams
    setRemoteStreams([]);
    Object.values(remoteVideosRef.current).forEach(video => {
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
    });
    remoteVideosRef.current = {};
  };

  const stopLiveStream = async () => {
    stopAllStreams();

    // Update live status
    const liveStatusRef = doc(db, 'system', 'liveStatus');
    await updateDoc(liveStatusRef, {
      isLive: false,
      stoppedAt: new Date()
    });

    // Delete all signaling messages
    const signalingRef = collection(db, 'liveSignaling');
    const snapshot = await query(collection(db, 'liveSignaling'));
    // Note: We'll handle cleanup in a different way

    if (onStopLive) {
      onStopLive();
    }
    onClose();
  };

  const listenForParticipants = () => {
    const signalingRef = collection(db, 'liveSignaling');
    const q = query(signalingRef, where('type', '==', 'join'));
    
    signalingUnsubscribeRef.current = onSnapshot(q, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' && isAdmin) {
          const data = change.doc.data();
          const userId = data.userId;
          
          // Create peer connection for new participant
          await createPeerConnection(userId, true);
        }
      });
    });
  };

  const joinLiveStream = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Send join signal
      const savedProfile = localStorage.getItem('userProfile');
      let userId = 'guest';
      let userName = 'Guest';
      
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          userId = profile.id || profile.email || 'guest';
          userName = profile.name || 'Guest';
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      }

      await addDoc(collection(db, 'liveSignaling'), {
        type: 'join',
        userId: userId,
        userName: userName,
        timestamp: serverTimestamp()
      });

      // Listen for admin's offer
      listenForAdminOffer(userId);
    } catch (error) {
      console.error('Error joining live stream:', error);
      alert('Error accessing camera/microphone. Please check permissions.');
    }
  };

  const listenForAdminOffer = (userId) => {
    const signalingRef = collection(db, 'liveSignaling');
    const q = query(signalingRef, where('type', '==', 'offer'), where('targetUserId', '==', userId));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          await handleOffer(data);
        }
      });
    });

    return unsubscribe;
  };

  const listenForSignaling = () => {
    const signalingRef = collection(db, 'liveSignaling');
    
    signalingUnsubscribeRef.current = onSnapshot(signalingRef, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        
        if (change.type === 'added') {
          if (data.type === 'answer' && isAdmin) {
            await handleAnswer(data);
          } else if (data.type === 'ice-candidate') {
            await handleIceCandidate(data);
          }
        }
      });
    });
  };

  const createPeerConnection = async (userId, isInitiator) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    peerConnectionsRef.current[userId] = pc;

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        const updated = [...prev.filter(s => s.userId !== userId), { userId, stream: remoteStream }];
        return updated;
      });

      // Set video element
      setTimeout(() => {
        const videoElement = document.getElementById(`remote-video-${userId}`);
        if (videoElement) {
          videoElement.srcObject = remoteStream;
        }
      }, 100);
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, 'liveSignaling'), {
          type: 'ice-candidate',
          candidate: event.candidate,
          userId: isAdmin ? 'admin' : userId,
          targetUserId: isAdmin ? userId : 'admin',
          timestamp: serverTimestamp()
        });
      }
    };

    if (isInitiator) {
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await addDoc(collection(db, 'liveSignaling'), {
        type: 'offer',
        offer: offer,
        userId: 'admin',
        targetUserId: userId,
        timestamp: serverTimestamp()
      });
    }

    return pc;
  };

  const handleOffer = async (data) => {
    const userId = 'admin';
    const pc = await createPeerConnection(userId, false);
    
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await addDoc(collection(db, 'liveSignaling'), {
      type: 'answer',
      answer: answer,
      userId: data.targetUserId,
      targetUserId: 'admin',
      timestamp: serverTimestamp()
    });
  };

  const handleAnswer = async (data) => {
    const pc = peerConnectionsRef.current[data.userId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  };

  const handleIceCandidate = async (data) => {
    const targetUserId = data.targetUserId;
    const pc = peerConnectionsRef.current[targetUserId];
    if (pc && data.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
        maxWidth: '90vw', 
        maxHeight: '90vh',
        width: '1200px',
        background: '#1f2937',
        color: 'white'
      }}>
        <div className="modal-header" style={{ 
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
          color: 'white',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FiVideo size={22} />
            </div>
            <h2 className="modal-title" style={{ color: 'white', margin: 0 }}>
              {isAdmin ? 'Live Streaming' : 'Live Stream'}
            </h2>
            <div style={{
              background: '#ef4444',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'white',
                animation: 'pulse 2s infinite'
              }}></span>
              LIVE
            </div>
          </div>
          <button 
            className="close-btn" 
            onClick={isAdmin ? stopLiveStream : onClose}
            style={{ color: 'white' }}
          >
            <FiX size={18} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isAdmin && !isLive && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <button 
                className="btn btn-primary"
                onClick={startLiveStream}
                style={{ 
                  fontSize: '18px', 
                  padding: '16px 32px',
                  background: '#ef4444',
                  border: 'none'
                }}
              >
                <FiVideo style={{ marginRight: '8px' }} />
                Start Live Stream
              </button>
            </div>
          )}

          {isLive && (
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: remoteStreams.length > 0 ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr',
                gap: '20px'
              }}>
                {/* Admin/User Video */}
                {localStream && (
                  <div style={{
                    background: '#111827',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    aspectRatio: '16/9'
                  }}>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600
                    }}>
                      {isAdmin ? 'You (Admin)' : 'You'}
                    </div>
                  </div>
                )}

                {/* Remote Videos */}
                {remoteStreams.map(({ userId, stream }) => (
                  <div
                    key={userId}
                    style={{
                      background: '#111827',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      position: 'relative',
                      aspectRatio: '16/9'
                    }}
                  >
                    <video
                      id={`remote-video-${userId}`}
                      autoPlay
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600
                    }}>
                      Participant
                    </div>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '12px',
                padding: '16px',
                background: '#111827',
                borderRadius: '12px'
              }}>
                <button
                  className="btn btn-secondary"
                  onClick={toggleVideo}
                  style={{
                    padding: '12px 24px',
                    background: isVideoEnabled ? '#374151' : '#ef4444',
                    border: 'none',
                    color: 'white'
                  }}
                >
                  {isVideoEnabled ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={toggleAudio}
                  style={{
                    padding: '12px 24px',
                    background: isAudioEnabled ? '#374151' : '#ef4444',
                    border: 'none',
                    color: 'white'
                  }}
                >
                  {isAudioEnabled ? <FiMic size={20} /> : <FiMicOff size={20} />}
                </button>
                {isAdmin && (
                  <button
                    className="btn btn-primary"
                    onClick={stopLiveStream}
                    style={{
                      padding: '12px 24px',
                      background: '#ef4444',
                      border: 'none',
                      color: 'white'
                    }}
                  >
                    Stop Live
                  </button>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: '#374151',
                  borderRadius: '8px',
                  color: 'white'
                }}>
                  <FiUsers size={20} />
                  <span>{remoteStreams.length + 1} participants</span>
                </div>
              </div>
            </>
          )}

          {!isLive && !isAdmin && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <FiVideo size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>Waiting for admin to start live stream...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveStreamModal;

