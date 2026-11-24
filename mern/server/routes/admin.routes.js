
const express = require("express");

const {
  createUser,
  getAllUsers,
  updateUserStatus,
} = require("../controllers/admin.controller");

const {
  protect,
  authorize,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All routes require an authenticated Admin
router.use(protect, authorize("ADMIN"));

// Create Cleaner or additional Admin
router.post("/users", createUser);

// View all users
router.get("/users", getAllUsers);

// Enable or disable a user account
router.patch("/users/:id/status", updateUserStatus);

module.exports = router;
