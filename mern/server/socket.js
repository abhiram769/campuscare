const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const { setRealtime } = require("./utils/realtime");

function attachSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id).select("_id isActive");
      if (!user || !user.isActive) return next(new Error("Account unavailable"));
      socket.userId = user._id.toString();
      next();
    } catch {
      next(new Error("Invalid or expired session"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);
  });

  setRealtime(io);
  return io;
}

module.exports = attachSocket;
