const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

dotenv.config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const emailRoutes = require("./routes/emailRoutes");

const app = express();

/* ==========================================
   HTTP / EXPRESS SETUP
========================================== */

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/emails", emailRoutes);

connectDB();

app.get("/", (req, res) => {
  res.json({
    message: "PhoneMail API is running"
  });
});

/* ==========================================
   HTTP SERVER
========================================== */

const httpServer = http.createServer(app);

/* ==========================================
   SOCKET.IO
========================================== */

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
});

/*
  Make Socket.IO accessible from controllers
  using:

  const io = req.app.get("io");
*/
app.set("io", io);

/* ==========================================
   SOCKET AUTHENTICATION
========================================== */

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication required")
      );
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    socket.user = decoded;

    next();

  } catch (error) {
    next(
      new Error(
        "Invalid or expired authentication token"
      )
    );
  }
});

/* ==========================================
   SOCKET CONNECTION
========================================== */

io.on("connection", (socket) => {

  const phoneNumber =
    socket.user.phoneNumber;

  /*
    Each user gets a private room named
    after their PhoneMail phone number.

    Example:

    User A -> "9876543210"
    User B -> "9123456789"
  */

  socket.join(phoneNumber);

  console.log(
    `Socket connected: ${phoneNumber}`
  );

  socket.emit("socket-connected", {
    message:
      "Real-time connection established"
  });

  socket.on("disconnect", () => {
    console.log(
      `Socket disconnected: ${phoneNumber}`
    );
  });

});

/* ==========================================
   START SERVER
========================================== */

const PORT =
  process.env.PORT || 5001;

httpServer.listen(
  PORT,
  () => {
    console.log(
      `Server running on http://localhost:${PORT}`
    );

    console.log(
      "Socket.IO real-time server is ready"
    );
  }
);