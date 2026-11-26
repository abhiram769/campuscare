
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLL_NUMBER_REGEX = /^m260\d{3}cs$/i;
const LAST_NAME_REGEX = /^[a-z]+$/i;

const isPublicRole = function () {
  return ["STUDENT", "FACULTY"].includes(this.role);
};

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
          if (isPublicRole.call(this)) {
            return ROLL_NUMBER_REGEX.test(value);
          }
          return true;
        },
        message: "Username must follow the format m260587cs (m260 + 3 digits + cs).",
      },
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      trim: true,
      lowercase: true,
      required: function () {
        return isPublicRole.call(this);
      },
      validate: {
        validator: function (value) {
          if (isPublicRole.call(this)) {
            return LAST_NAME_REGEX.test(value || "");
          }
          return true;
        },
        message: "Last name is required and must contain letters only.",
      },
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (value) {
          if (isPublicRole.call(this)) {
            const username = this.username?.trim().toLowerCase();
            const lastName = this.lastName?.trim().toLowerCase();

            if (!username || !LAST_NAME_REGEX.test(lastName || "")) {
              return false;
            }

            return value ===
              `${lastName}_${username}@nitc.ac.in`;
          }
          return true;
        },
        message: "Use your NITC email in the format lastname_username@nitc.ac.in.",
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
