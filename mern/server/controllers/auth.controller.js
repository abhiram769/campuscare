
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const ROLL_NUMBER_REGEX = /^m260\d{3}cs$/i;
const LAST_NAME_REGEX = /^[a-z]+$/i;

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
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    }
  );
}

// REGISTER
exports.register = async (req, res, next) => {
  try {
    const {
      username,
      firstName,
      lastName,
      email,
      password,
      role,
      department,
      phone
    } = req.body;

    if (!username || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, first name, last name, email and password are required."
      });
    }

    // Normalize input
    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFirstName = String(firstName).trim();
    const normalizedLastName = String(lastName).trim().toLowerCase();

    // Public registration only allows Student and Faculty
    const safeRole = role === "FACULTY" ? "FACULTY" : "STUDENT";

    // Validate NITC username
    if (!ROLL_NUMBER_REGEX.test(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message: "Invalid username. Use the format m260587cs (m260 + 3 digits + cs)."
      });
    }

    // Validate last name
    if (!LAST_NAME_REGEX.test(normalizedLastName)) {
      return res.status(400).json({
        success: false,
        message: "Last name is required and must contain letters only."
      });
    }

    // Validate email against last name and username
    const expectedEmail =
      `${normalizedLastName}_${normalizedUsername}@nitc.ac.in`;

    if (normalizedEmail !== expectedEmail) {
      return res.status(400).json({
        success: false,
        message: `Use your NITC institutional email in this format: ${expectedEmail}`
      });
    }

    // Validate password
    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters."
      });
    }

    if (!normalizedFirstName) {
      return res.status(400).json({
        success: false,
        message: "First name is required."
      });
    }

    // Check duplicate username or email
    const existing = await User.findOne({
      $or: [
        { username: normalizedUsername },
        { email: normalizedEmail }
      ]
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Username or email is already registered."
      });
    }

    // Create account
    const user = await User.create({
      username: normalizedUsername,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      password,
      role: safeRole,
      department: department || "",
      phone: phone || ""
    });

    return res.status(201).json({
      success: true,
      message: "Account created.",
      token: issueToken(user),
      user: publicUser(user)
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username or email is already registered."
      });
    }

    next(error);
  }
};

// LOGIN
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Enter your username/email and password."
      });
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();

    const user = await User.findOne({
      $or: [
        { username: normalizedIdentifier },
        { email: normalizedIdentifier }
      ]
    }).select("+password");

    if (
      !user ||
      !user.isActive ||
      !(await user.comparePassword(password))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials or inactive account."
      });
    }

    return res.json({
      success: true,
      token: issueToken(user),
      user: publicUser(user)
    });

  } catch (error) {
    next(error);
  }
};

// GET CURRENT USER
exports.me = (req, res) => {
  res.json({
    success: true,
    user: publicUser(req.user)
  });
};
