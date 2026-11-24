const jwt = require("jsonwebtoken");
const User = require("../models/User");

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  department: user.department,
  phone: user.phone
});

function issueToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d"
  });
}

exports.register = async (req, res, next) => {
  try {
    const { username, firstName, lastName, email, password, role, department } = req.body;
    if (!username || !firstName || !email || !password) {
      return res.status(400).json({ success: false, message: "Username, first name, email and password are required." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: "Password must contain at least 8 characters." });
    }
    const safeRole = role === "FACULTY" ? "FACULTY" : "STUDENT";
    const existing = await User.findOne({ $or: [
      { username: String(username).trim().toLowerCase() },
      { email: String(email).trim().toLowerCase() }
    ] });
    if (existing) return res.status(409).json({ success: false, message: "Username or email is already registered." });

    const user = await User.create({ username, firstName, lastName, email, password, role: safeRole, department });
    return res.status(201).json({ success: true, message: "Account created.", token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, message: "Enter your username/email and password." });
    const user = await User.findOne({ $or: [
      { username: String(identifier).trim().toLowerCase() },
      { email: String(identifier).trim().toLowerCase() }
    ] }).select("+password");
    if (!user || !user.isActive || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials or inactive account." });
    }
    return res.json({ success: true, token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
};

exports.me = (req, res) => res.json({ success: true, user: publicUser(req.user) });
