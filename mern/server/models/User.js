
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLL_NUMBER_REGEX = /^m260\d{5}$/i;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (value) {
          // Roll-number validation for student and faculty accounts.
          if (["STUDENT", "FACULTY"].includes(this.role)) {
            return ROLL_NUMBER_REGEX.test(value);
          }
          return true;
        },
        message: "Username must be a valid NITC roll number (example: m26012345).",
      },
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (value) {
          if (["STUDENT", "FACULTY"].includes(this.role)) {
            const username = this.username?.trim().toLowerCase();
            return value === `${username}@nitc.ac.in`;
          }
          return true;
        },
        message: "Use your NITC email matching your roll number (example: m26012345@nitc.ac.in).",
      },
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["STUDENT", "FACULTY", "CLEANER", "ADMIN"],
      default: "STUDENT",
    },

    department: {
      type: String,
      trim: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
});

// Compare login password with hashed password.
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
