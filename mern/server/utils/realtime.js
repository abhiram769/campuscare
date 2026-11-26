let io;

function setRealtime(serverIo) {
  io = serverIo;
}

function emitToUser(userId, notification) {
  if (io && userId) io.to(`user:${userId.toString()}`).emit("notification:new", notification);
}

module.exports = { setRealtime, emitToUser };
