import * as React from 'react';

interface ErrorProps {
  error: string;
  message: string;
}

export const Error: React.FC<ErrorProps> = ({ error, message }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header with Error Icon */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-12 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white">{error}</h1>
        </div>

        {/* Error Message */}
        <div className="px-6 py-8 text-center">
          <p className="text-gray-600 text-lg mb-8">{message}</p>
          
          {/* Back to Home Button */}
          <a
            href="/"
            className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-md font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Go to Home
          </a>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            If this problem persists, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
};
