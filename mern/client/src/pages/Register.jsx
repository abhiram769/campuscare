
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLL_NUMBER_REGEX = /^m260\d{3}cs$/i;
const LAST_NAME_REGEX = /^[a-z]+$/i;

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    department: "",
    phone: "",
    role: "STUDENT",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const username = form.username.trim().toLowerCase();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim().toLowerCase();
    const email = form.email.trim().toLowerCase();

    if (!ROLL_NUMBER_REGEX.test(username)) {
      setError(
        "Username must follow the format m260587cs (m260 + 3 digits + cs)."
      );
      return;
    }

    if (!lastName) {
      setError("Last name is required.");
      return;
    }

    if (!LAST_NAME_REGEX.test(lastName)) {
      setError("Last name must contain letters only.");
      return;
    }

    const expectedEmail = `${lastName}_${username}@nitc.ac.in`;

    if (email !== expectedEmail) {
      setError(
        `Use your NITC email in this format: ${expectedEmail}`
      );
      return;
    }

    if (!firstName) {
      setError("First name is required.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const user = await register({
        ...form,
        username,
        firstName,
        lastName,
        email,
      });

      navigate(
        user.role === "FACULTY"
          ? "/faculty/dashboard"
          : "/student/dashboard"
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card register-card">
        <Link to="/" className="auth-brand">
          Campus Care
        </Link>

        <h1>Create Account</h1>
        <p>Join us in building a cleaner campus.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Account Type</label>
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
          >
            <option value="STUDENT">Student</option>
            <option value="FACULTY">Faculty</option>
          </select>

          <label>Username</label>
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Example: m260587cs"
            pattern="m260[0-9]{3}cs"
            title="Use m260 followed by exactly 3 digits and cs."
            maxLength={9}
            required
          />

          <label>First Name</label>
          <input
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            placeholder="First name"
            required
          />

          <label>Last Name</label>
          <input
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            placeholder="Example: kumar"
            pattern="[A-Za-z]+"
            title="Last name must contain letters only."
            required
          />

          <label>Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="kumar_m260587cs@nitc.ac.in"
            required
          />

          <label>Department</label>
          <input
            name="department"
            value={form.department}
            onChange={handleChange}
            placeholder="Department"
          />

          <label>Phone</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Phone number"
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Minimum 8 characters"
            minLength={8}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <div className="auth-footer">
          Already registered?{" "}
          <Link to="/login">Login here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
