import { useState } from 'react';
import { useApiStatus } from './ApiStatusProvider';

export function ApiSetupGuide() {
  const { isOnline, isChecking } = useApiStatus();
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show in development when API is offline
  if (process.env.NODE_ENV !== 'development' || isOnline || isChecking) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-md z-50">
      <div className="bg-white rounded-lg shadow-lg border border-yellow-400">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div className="flex items-center">
            <span className="text-yellow-500 mr-2">⚠️</span>
            <span className="font-medium">API Service Not Running</span>
          </div>
          <svg
            className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isExpanded && (
          <div className="px-4 pb-4 border-t">
            <p className="text-sm text-gray-600 mt-3 mb-3">
              The API service is required for full functionality. To start it:
            </p>
            <div className="bg-gray-100 rounded p-3 font-mono text-xs">
              <p className="text-gray-700"># In the subsquid directory:</p>
              <p className="text-gray-900">cd ../subsquid</p>
              <p className="text-gray-900">yarn install</p>
              <p className="text-gray-900">yarn api</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
