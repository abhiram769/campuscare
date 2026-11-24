
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

const createInitialAdmin = async () => {
  try {
    if (!process.env.MONGO_URI || !process.env.ADMIN_PASSWORD) {
      throw new Error("MONGO_URI or ADMIN_PASSWORD is missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const existingAdmin = await User.findOne({
      role: "ADMIN",
    });

    if (existingAdmin) {
      console.log("An Admin account already exists. No new account created.");
      return;
    }

    const admin = await User.create({
      username: process.env.ADMIN_USERNAME,
      firstName: process.env.ADMIN_FIRST_NAME,
      lastName: process.env.ADMIN_LAST_NAME || "",
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: "ADMIN",
      isActive: true,
    });

    console.log("Initial Admin account created successfully.");
    console.log("Username:", admin.username);
    console.log("Email:", admin.email);
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createInitialAdmin();
