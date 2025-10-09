import { useEffect, useState } from 'react';

interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: number;
}

/**
 * Mobile Error Overlay - shows errors visually when console is not accessible
 * Captures unhandled errors and rejections during app initialization
 */
export function MobileErrorOverlay() {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Capture unhandled errors
    const handleError = (event: ErrorEvent) => {
      console.error('[Mobile Error Overlay] Caught error:', event.error);
      setErrors(prev => [...prev, {
        message: event.message || String(event.error),
        stack: event.error?.stack,
        timestamp: Date.now(),
      }]);
      setIsVisible(true);
    };

    // Capture unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[Mobile Error Overlay] Caught rejection:', event.reason);
      setErrors(prev => [...prev, {
        message: String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now(),
      }]);
      setIsVisible(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (!isVisible || errors.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1a1a1a',
        color: '#fff',
        zIndex: 999999,
        overflow: 'auto',
        padding: '20px',
        fontFamily: 'monospace',
        fontSize: '12px',
      }}
    >
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '18px', color: '#ff4444' }}>
          ⚠️ Application Error ({errors.length})
        </h1>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Reload Page
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#333', borderRadius: '5px' }}>
        <strong>Device Info:</strong>
        <div>User Agent: {navigator.userAgent}</div>
        <div>Screen: {window.screen.width}x{window.screen.height}</div>
        <div>Viewport: {window.innerWidth}x{window.innerHeight}</div>
      </div>

      {errors.map((error, index) => (
        <div
          key={index}
          style={{
            marginBottom: '15px',
            padding: '15px',
            backgroundColor: '#2a2a2a',
            borderLeft: '4px solid #ff4444',
            borderRadius: '5px',
          }}
        >
          <div style={{ marginBottom: '10px', color: '#ff6b6b', fontWeight: 'bold' }}>
            Error #{index + 1} at {new Date(error.timestamp).toLocaleTimeString()}
          </div>
          <div style={{ marginBottom: '10px', wordBreak: 'break-word' }}>
            <strong>Message:</strong> {error.message}
          </div>
          {error.stack && (
            <details style={{ marginTop: '10px' }}>
              <summary style={{ cursor: 'pointer', color: '#4dabf7' }}>
                Stack Trace
              </summary>
              <pre style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: '#1a1a1a',
                borderRadius: '3px',
                overflow: 'auto',
                fontSize: '10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      ))}

      <button
        onClick={() => {
          setErrors([]);
          setIsVisible(false);
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#666',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontSize: '14px',
          cursor: 'pointer',
          marginTop: '20px',
        }}
      >
        Dismiss Errors
      </button>
    </div>
  );
}
