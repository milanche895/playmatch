import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="bg-white border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-semibold">PlayMatch Global</Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:underline">Home</Link>
          <Link to="/create" className="hover:underline">Create Match</Link>
          {user ? (
            <button
              className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
              onClick={async () => { await logout(); navigate('/'); }}
            >Logout</button>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="hover:underline">Login</Link>
              <Link to="/register" className="hover:underline">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}


