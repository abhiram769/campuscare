const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, default: "", trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ["STUDENT", "FACULTY", "CLEANER", "ADMIN"], default: "STUDENT" },
  department: { type: String, trim: true, default: "" },
  phone: { type: String, trim: true, default: "" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
