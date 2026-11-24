
const mongoose = require("mongoose");
const User = require("../models/User");

// Remove password from API responses
const formatUser = (user) => ({
  id: user._id,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  department: user.department,
  phone: user.phone,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

// ADMIN CREATES CLEANER OR ANOTHER ADMIN
const createUser = async (req, res) => {
  try {
    const {
      username,
      firstName,
      lastName,
      email,
      password,
      department,
      phone,
      role,
    } = req.body;

    const allowedRoles = ["CLEANER", "ADMIN"];

    const selectedRole = role?.toUpperCase();

    if (!allowedRoles.includes(selectedRole)) {
      return res.status(400).json({
        success: false,
        message: "Admin can create only Cleaner or Admin accounts.",
      });
    }

    if (!username || !firstName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, first name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [
        { username: normalizedUsername },
        { email: normalizedEmail },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists.",
      });
    }

    const user = await User.create({
      username: normalizedUsername,
      firstName,
      lastName,
      email: normalizedEmail,
      password,
      department,
      phone,
      role: selectedRole,
    });

    return res.status(201).json({
      success: true,
      message: `${selectedRole} account created successfully.`,
      user: formatUser(user),
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists.",
      });
    }

    console.error("Create user error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create account.",
    });
  }
};

// ADMIN VIEWS ALL USERS
const getAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    const filter = {};

    if (role) {
      const normalizedRole = role.toUpperCase();

      if (!["STUDENT", "FACULTY", "CLEANER", "ADMIN"].includes(normalizedRole)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role.",
        });
      }

      filter.role = normalizedRole;
    }

    if (search) {
      const searchRegex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      filter.$or = [
        { username: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users: users.map(formatUser),
    });

  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve users.",
    });
  }
};

// ADMIN ENABLES OR DISABLES AN ACCOUNT
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot disable your own account.",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Account ${isActive ? "enabled" : "disabled"} successfully.`,
      user: formatUser(user),
    });

  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update account status.",
    });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  updateUserStatus,
};
