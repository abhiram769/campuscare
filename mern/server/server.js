require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const complaintRoutes = require("./routes/complaint.routes");
const adminRoutes = require("./routes/admin.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(require("path").join(__dirname, "uploads"), { maxAge: "7d", immutable: true }));
app.use(morgan("dev"));

app.get("/", (req, res) => res.json({ success: true, message: "Campus Care API" }));
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Campus Care API listening at http://localhost:${PORT}`));
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}
startServer();
