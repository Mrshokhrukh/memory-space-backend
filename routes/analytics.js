const express = require("express")
const router = express.Router()
const { getAnalytics, getDashboardStats } = require("../middleware/analytics")
const auth = require("../middleware/auth")

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    })
  }
  next()
}

// @route   GET /api/analytics
// @desc    Get analytics data
// @access  Private (Admin only)
router.get("/", [auth, adminOnly], getAnalytics)

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard statistics
// @access  Private (Admin only)
router.get("/dashboard", [auth, adminOnly], getDashboardStats)

module.exports = router
