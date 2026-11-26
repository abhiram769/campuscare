
import { useState } from "react";
import { Home } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(identifier, password);

      const dashboards = {
        STUDENT: "/student/dashboard",
        FACULTY: "/faculty/dashboard",
        CLEANER: "/cleaner/dashboard",
        ADMIN: "/admin/dashboard",
      };

      navigate(dashboards[user.role] || "/");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-home-button">
  <Home size={16} />
  <span>Home</span>
</Link>
        <Link to="/" className="auth-brand">
          Campus Care
        </Link>

        <h1>Welcome Back!</h1>
        <p>Login to access your Campus Care account.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Username or Email</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter username or email"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
