export default function Custom404() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-pink-100 to-purple-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page Not Found</p>
        <a
          href="/"
          className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
        >
          Return Home
        </a>
      </div>
    </div>
  );
}
