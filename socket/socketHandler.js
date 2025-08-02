const jwt = require("jsonwebtoken")
const User = require("../models/User")
const Capsule = require("../models/Capsule")

// Store active users and their socket connections
const activeUsers = new Map()
const capsuleRooms = new Map()

const socketHandler = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error("Authentication error"))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId).select("-password")

      if (!user) {
        return next(new Error("User not found"))
      }

      socket.userId = user._id.toString()
      socket.user = user
      next()
    } catch (error) {
      next(new Error("Authentication error"))
    }
  })

  io.on("connection", (socket) => {
    console.log(`✅ User ${socket.user.name} connected: ${socket.id}`)

    // Add user to active users
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      joinedAt: new Date(),
    })

    // Emit user online status
    socket.broadcast.emit("user_online", {
      userId: socket.userId,
      user: socket.user,
    })

    // Join user's capsules
    socket.on("join_capsules", async () => {
      try {
        const userCapsules = await Capsule.find({
          $or: [{ owner: socket.userId }, { "contributors.user": socket.userId }],
        }).select("_id")

        userCapsules.forEach((capsule) => {
          const roomName = `capsule_${capsule._id}`
          socket.join(roomName)

          // Track users in capsule rooms
          if (!capsuleRooms.has(roomName)) {
            capsuleRooms.set(roomName, new Set())
          }
          capsuleRooms.get(roomName).add(socket.userId)

          // Notify others in the capsule
          socket.to(roomName).emit("user_joined_capsule", {
            userId: socket.userId,
            user: socket.user,
            capsuleId: capsule._id,
          })
        })

        console.log(`📱 User ${socket.user.name} joined ${userCapsules.length} capsule rooms`)
      } catch (error) {
        console.error("Join capsules error:", error)
        socket.emit("error", { message: "Failed to join capsules" })
      }
    })

    // Join specific capsule room
    socket.on("join_capsule", async (capsuleId) => {
      try {
        const capsule = await Capsule.findById(capsuleId)

        if (!capsule) {
          return socket.emit("error", { message: "Capsule not found" })
        }

        // Check if user has access
        const hasAccess =
          capsule.owner.toString() === socket.userId ||
          capsule.contributors.some((c) => c.user.toString() === socket.userId)

        if (!hasAccess) {
          return socket.emit("error", { message: "Access denied" })
        }

        const roomName = `capsule_${capsuleId}`
        socket.join(roomName)

        // Track users in capsule room
        if (!capsuleRooms.has(roomName)) {
          capsuleRooms.set(roomName, new Set())
        }
        capsuleRooms.get(roomName).add(socket.userId)

        // Get active users in this capsule
        const activeUsersInCapsule = Array.from(capsuleRooms.get(roomName))
          .map((userId) => activeUsers.get(userId))
          .filter(Boolean)

        socket.emit("capsule_joined", {
          capsuleId,
          activeUsers: activeUsersInCapsule,
        })

        // Notify others
        socket.to(roomName).emit("user_joined_capsule", {
          userId: socket.userId,
          user: socket.user,
          capsuleId,
        })

        console.log(`📱 User ${socket.user.name} joined capsule ${capsuleId}`)
      } catch (error) {
        console.error("Join capsule error:", error)
        socket.emit("error", { message: "Failed to join capsule" })
      }
    })

    // Leave capsule room
    socket.on("leave_capsule", (capsuleId) => {
      const roomName = `capsule_${capsuleId}`
      socket.leave(roomName)

      // Remove from capsule room tracking
      if (capsuleRooms.has(roomName)) {
        capsuleRooms.get(roomName).delete(socket.userId)
        if (capsuleRooms.get(roomName).size === 0) {
          capsuleRooms.delete(roomName)
        }
      }

      // Notify others
      socket.to(roomName).emit("user_left_capsule", {
        userId: socket.userId,
        user: socket.user,
        capsuleId,
      })

      console.log(`📱 User ${socket.user.name} left capsule ${capsuleId}`)
    })

    // Typing indicators
    socket.on("typing_start", ({ capsuleId, memoryId }) => {
      const roomName = `capsule_${capsuleId}`
      socket.to(roomName).emit("user_typing", {
        userId: socket.userId,
        user: socket.user,
        capsuleId,
        memoryId,
        isTyping: true,
      })
    })

    socket.on("typing_stop", ({ capsuleId, memoryId }) => {
      const roomName = `capsule_${capsuleId}`
      socket.to(roomName).emit("user_typing", {
        userId: socket.userId,
        user: socket.user,
        capsuleId,
        memoryId,
        isTyping: false,
      })
    })

    // Live reactions (temporary visual reactions)
    socket.on("live_reaction", ({ capsuleId, memoryId, emoji, position }) => {
      const roomName = `capsule_${capsuleId}`
      socket.to(roomName).emit("live_reaction", {
        userId: socket.userId,
        user: socket.user,
        capsuleId,
        memoryId,
        emoji,
        position,
        timestamp: new Date(),
      })
    })

    // Memory viewing status
    socket.on("viewing_memory", ({ capsuleId, memoryId }) => {
      const roomName = `capsule_${capsuleId}`
      socket.to(roomName).emit("user_viewing_memory", {
        userId: socket.userId,
        user: socket.user,
        capsuleId,
        memoryId,
      })
    })

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`❌ User ${socket.user.name} disconnected: ${reason}`)

      // Remove from active users
      activeUsers.delete(socket.userId)

      // Remove from all capsule rooms
      capsuleRooms.forEach((users, roomName) => {
        if (users.has(socket.userId)) {
          users.delete(socket.userId)
          socket.to(roomName).emit("user_left_capsule", {
            userId: socket.userId,
            user: socket.user,
            capsuleId: roomName.replace("capsule_", ""),
          })

          if (users.size === 0) {
            capsuleRooms.delete(roomName)
          }
        }
      })

      // Emit user offline status
      socket.broadcast.emit("user_offline", {
        userId: socket.userId,
        user: socket.user,
      })
    })

    // Error handling
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.user.name}:`, error)
    })
  })

  // Periodic cleanup of inactive connections
  setInterval(
    () => {
      const now = new Date()
      activeUsers.forEach((userData, userId) => {
        const timeDiff = now - userData.joinedAt
        // Remove users inactive for more than 1 hour
        if (timeDiff > 60 * 60 * 1000) {
          activeUsers.delete(userId)
        }
      })
    },
    5 * 60 * 1000,
  ) // Check every 5 minutes
}

// Helper functions to get active users
const getActiveUsers = () => {
  return Array.from(activeUsers.values())
}

const getActiveUsersInCapsule = (capsuleId) => {
  const roomName = `capsule_${capsuleId}`
  if (!capsuleRooms.has(roomName)) return []

  return Array.from(capsuleRooms.get(roomName))
    .map((userId) => activeUsers.get(userId))
    .filter(Boolean)
}

const isUserOnline = (userId) => {
  return activeUsers.has(userId)
}

module.exports = socketHandler
module.exports.getActiveUsers = getActiveUsers
module.exports.getActiveUsersInCapsule = getActiveUsersInCapsule
module.exports.isUserOnline = isUserOnline
