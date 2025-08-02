const jwt = require("jsonwebtoken")
const User = require("../models/User")

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  })
}

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId).select("-password")

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token - user not found",
      })
    }

    // Update last active
    user.lastActive = new Date()
    await user.save()

    req.user = user
    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      })
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      })
    }

    console.error("Auth middleware error:", error)
    res.status(500).json({
      success: false,
      message: "Authentication error",
    })
  }
}

// Optional authentication (for public routes that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(" ")[1]

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId).select("-password")
      if (user) {
        req.user = user
      }
    }
    next()
  } catch (error) {
    // Continue without authentication for optional auth
    next()
  }
}

// Check if user is capsule owner or admin
const checkCapsulePermission = (requiredRole = "contributor") => {
  return async (req, res, next) => {
    try {
      const Capsule = require("../models/Capsule")
      const capsule = await Capsule.findById(req.params.capsuleId)

      if (!capsule) {
        return res.status(404).json({
          success: false,
          message: "Capsule not found",
        })
      }

      // Check if user is owner
      if (capsule.owner.toString() === req.user._id.toString()) {
        req.userRole = "owner"
        return next()
      }

      // Check if user is contributor
      const contributor = capsule.contributors.find((c) => c.user.toString() === req.user._id.toString())

      if (!contributor) {
        return res.status(403).json({
          success: false,
          message: "Access denied - not a capsule member",
        })
      }

      // Check role permissions
      const roleHierarchy = {
        viewer: 1,
        contributor: 2,
        admin: 3,
        owner: 4,
      }

      if (roleHierarchy[contributor.role] < roleHierarchy[requiredRole]) {
        return res.status(403).json({
          success: false,
          message: `Access denied - ${requiredRole} role required`,
        })
      }

      req.userRole = contributor.role
      req.capsule = capsule
      next()
    } catch (error) {
      console.error("Permission check error:", error)
      res.status(500).json({
        success: false,
        message: "Permission check failed",
      })
    }
  }
}

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  checkCapsulePermission,
}
