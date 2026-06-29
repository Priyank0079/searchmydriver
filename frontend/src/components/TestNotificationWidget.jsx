import React, { useState } from 'react';
import useUserAuthStore from '../store/useUserAuthStore';
import useDriverAuthStore from '../store/useDriverAuthStore';
import api from '../utils/api';

export default function TestNotificationWidget() {
  const { isAuthenticated: isUserAuthenticated } = useUserAuthStore();
  const { isAuthenticated: isDriverAuthenticated } = useDriverAuthStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null
  const [message, setMessage] = useState('');

  // Only render if logged in as user or driver
  if (!isUserAuthenticated && !isDriverAuthenticated) return null;

  const triggerTestPush = async () => {
    setLoading(true);
    setStatus(null);
    setMessage('');
    
    try {
      const endpoint = isUserAuthenticated ? '/auth/test-push' : '/driver/test-push';
      const response = await api.post(endpoint, {});
      setStatus('success');
      setMessage(response?.data?.message || 'Test push notification sent!');
    } catch (err) {
      console.error('[FCM Test] Failed to trigger push:', err);
      setStatus('error');
      setMessage(err.response?.data?.message || 'Failed to send test push');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {isOpen ? (
        <div style={styles.card}>
          <div style={styles.header}>
            <span style={styles.title}>🔔 Push Notification Test Mode</span>
            <button style={styles.closeBtn} onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <p style={styles.text}>
            Test end-to-end Firebase Push Notifications. Tap the button below to trigger an instant push to this device.
          </p>

          <button 
            style={{
              ...styles.testBtn,
              ...(loading ? styles.disabledBtn : {})
            }}
            onClick={triggerTestPush}
            disabled={loading}
          >
            {loading ? 'Sending...' : '⚡ Send Test Push'}
          </button>

          {status && (
            <div style={{
              ...styles.statusContainer,
              backgroundColor: status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              borderColor: status === 'success' ? '#10b981' : '#ef4444',
              color: status === 'success' ? '#10b981' : '#ef4444',
            }}>
              {message}
            </div>
          )}
        </div>
      ) : (
        <button style={styles.floatingBtn} onClick={() => setIsOpen(true)}>
          🔔 Test Push
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 99999,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  floatingBtn: {
    backgroundColor: '#3b82f6',
    backgroundImage: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '30px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  card: {
    width: '320px',
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
    color: '#f4f4f5',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#a1a1aa',
    fontSize: '22px',
    cursor: 'pointer',
    lineHeight: '1',
    padding: '0',
    '&:hover': {
      color: '#ffffff',
    }
  },
  text: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#d4d4d8',
    margin: '0 0 8px 0',
  },
  testBtn: {
    backgroundColor: '#10b981',
    backgroundImage: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
  },
  disabledBtn: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  statusContainer: {
    fontSize: '12px',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid',
    textAlign: 'center',
    marginTop: '4px',
    wordBreak: 'break-word',
  }
};
