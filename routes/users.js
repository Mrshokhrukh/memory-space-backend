const express = require("express")
const User = require("../models/User")
const Capsule = require("../models/Capsule")
const MemoryItem = require("../models/MemoryItem")

const router = express.Router()

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      data: {
        user,
      },
    })
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
    })
  }
})

// @route   PUT /api/users/profile
// @desc    Update current user profile
// @access  Private
router.put("/profile", async (req, res) => {
  try {
    const { name, bio, avatarUrl } = req.body
    const updateData = {}

    if (name !== undefined) updateData.name = name
    if (bio !== undefined) updateData.bio = bio
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user,
      },
    })
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    })
  }
})

// @route   GET /api/users/stats
// @desc    Get current user statistics
// @access  Private
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user.id

    // Get counts
    const [capsulesCount, memoriesCount, joinedCapsulesCount] = await Promise.all([
      Capsule.countDocuments({ creator: userId }),
      MemoryItem.countDocuments({ creator: userId }),
      User.findById(userId).select("joinedCapsules").then(user => user?.joinedCapsules?.length || 0)
    ])

    res.json({
      success: true,
      data: {
        stats: {
          capsulesCreated: capsulesCount,
          memoriesCreated: memoriesCount,
          capsulesJoined: joinedCapsulesCount,
        },
      },
    })
  } catch (error) {
    console.error("Get stats error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get statistics",
    })
  }
})

// @route   GET /api/users/:id
// @desc    Get user by ID (public profile)
// @access  Private
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("name avatarUrl bio createdAt")
      .populate("createdCapsules", "title description coverImage createdAt")
      .populate("joinedCapsules", "title description coverImage createdAt")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      data: {
        user,
      },
    })
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get user",
    })
  }
})

module.exports = router 