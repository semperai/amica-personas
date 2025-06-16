// src/components/ErrorNotification.tsx
import { useEffect, useState } from 'react';

export interface Notification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: number;
}

// Global notification state
let listeners: Array<(notification: Notification) => void> = [];
let notificationIdCounter = 0;

export const notificationManager = {
  show: (message: string, type: Notification['type'] = 'error') => {
    const notification: Notification = {
      id: `notification-${++notificationIdCounter}`,
      message,
      type,
      timestamp: Date.now(),
    };
    
    listeners.forEach(listener => listener(notification));
  },
  
  subscribe: (listener: (notification: Notification) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },
};

// Replace the error notification in the GraphQL client with this
export function setupErrorNotifications() {
  if (typeof window !== 'undefined') {
    (window as typeof window & { errorNotification: typeof notificationManager }).errorNotification = notificationManager;
  }
}

export function ErrorNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationManager.subscribe((notification) => {
      setNotifications(prev => [...prev, notification]);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    });

    return unsubscribe;
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            pointer-events-auto transform transition-all duration-300 ease-out
            animate-slide-in-right max-w-md rounded-lg shadow-lg backdrop-blur-md
            ${notification.type === 'error' ? 'bg-red-500/90 text-white' :
              notification.type === 'warning' ? 'bg-yellow-500/90 text-white' :
              notification.type === 'success' ? 'bg-green-500/90 text-white' :
              'bg-blue-500/90 text-white'}
          `}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'error' && (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'warning' && (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'success' && (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'info' && (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium">
                  {notification.type === 'error' ? 'Error' :
                   notification.type === 'warning' ? 'Warning' :
                   notification.type === 'success' ? 'Success' : 'Info'}
                </p>
                <p className="mt-1 text-sm opacity-90">
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className="rounded-md inline-flex text-white/80 hover:text-white focus:outline-none transition-colors"
                  onClick={() => removeNotification(notification.id)}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Add this CSS to your global styles or as a styled component
const slideInAnimation = `
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }
`;

// Export the CSS for inclusion in your global styles
export const errorNotificationStyles = slideInAnimation;
