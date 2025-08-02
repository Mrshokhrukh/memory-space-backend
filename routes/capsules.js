const express = require("express")
const Capsule = require("../models/Capsule")
const MemoryItem = require("../models/MemoryItem")
const User = require("../models/User")
const { checkCapsulePermission } = require("../middleware/auth")
const { validateCapsuleCreation, validateObjectId, validatePagination } = require("../middleware/validation")

const router = express.Router()

// @route   GET /api/capsules
// @desc    Get user's capsules
// @access  Private
router.get("/", validatePagination, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    // Get capsules where user is owner or contributor
    const capsules = await Capsule.find({
      $or: [{ owner: req.user._id }, { "contributors.user": req.user._id }],
      isActive: true,
    })
      .populate("owner", "name avatarUrl")
      .populate("contributors.user", "name avatarUrl")
      .sort({ "stats.lastActivity": -1 })
      .skip(skip)
      .limit(limit)

    const total = await Capsule.countDocuments({
      $or: [{ owner: req.user._id }, { "contributors.user": req.user._id }],
      isActive: true,
    })

    res.json({
      success: true,
      data: {
        capsules,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Get capsules error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get capsules",
    })
  }
})

// @route   POST /api/capsules
// @desc    Create a new capsule
// @access  Private
router.post("/", validateCapsuleCreation, async (req, res) => {
  try {
    const { title, description, type, releaseDate, theme, tags } = req.body

    const capsule = new Capsule({
      title,
      description,
      type,
      owner: req.user._id,
      contributors: [
        {
          user: req.user._id,
          role: "admin",
        },
      ],
      releaseDate: type === "timed" ? releaseDate : undefined,
      theme: theme || "default",
      tags: tags || [],
    })

    await capsule.save()

    // Add to user's created capsules
    await User.findByIdAndUpdate(req.user._id, {
      $push: { createdCapsules: capsule._id },
    })

    await capsule.populate("owner", "name avatarUrl")
    await capsule.populate("contributors.user", "name avatarUrl")

    // Emit to socket
    req.io.emit("capsule_created", {
      capsule,
      creator: req.user,
    })

    res.status(201).json({
      success: true,
      message: "Capsule created successfully",
      data: { capsule },
    })
  } catch (error) {
    console.error("Create capsule error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create capsule",
    })
  }
})

// @route   GET /api/capsules/:id
// @desc    Get capsule by ID
// @access  Private
router.get("/:id", validateObjectId("id"), checkCapsulePermission("viewer"), async (req, res) => {
  try {
    const capsule = await Capsule.findById(req.params.id)
      .populate("owner", "name avatarUrl bio")
      .populate("contributors.user", "name avatarUrl bio lastActive")
      .populate({
        path: "content",
        populate: {
          path: "author",
          select: "name avatarUrl",
        },
        options: { sort: { createdAt: -1 } },
      })

    if (!capsule) {
      return res.status(404).json({
        success: false,
        message: "Capsule not found",
      })
    }

    // Check if capsule is timed and not yet released
    if (capsule.type === "timed" && new Date() < capsule.releaseDate) {
      // Only owner and admins can see unreleased timed capsules
      if (req.userRole !== "owner" && req.userRole !== "admin") {
        return res.status(403).json({
          success: false,
          message: "This capsule is not yet available",
          releaseDate: capsule.releaseDate,
        })
      }
    }

    res.json({
      success: true,
      data: { capsule, userRole: req.userRole },
    })
  } catch (error) {
    console.error("Get capsule error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get capsule",
    })
  }
})

// @route   PUT /api/capsules/:id
// @desc    Update capsule
// @access  Private (Admin/Owner only)
router.put("/:id", validateObjectId("id"), checkCapsulePermission("admin"), async (req, res) => {
  try {
    const { title, description, theme, tags, settings } = req.body

    const capsule = await Capsule.findById(req.params.id)

    if (title) capsule.title = title
    if (description !== undefined) capsule.description = description
    if (theme) capsule.theme = theme
    if (tags) capsule.tags = tags
    if (settings) capsule.settings = { ...capsule.settings, ...settings }

    capsule.stats.lastActivity = new Date()
    await capsule.save()

    await capsule.populate("owner", "name avatarUrl")
    await capsule.populate("contributors.user", "name avatarUrl")

    // Emit to socket
    req.io.to(`capsule_${capsule._id}`).emit("capsule_updated", {
      capsule,
      updatedBy: req.user,
    })

    res.json({
      success: true,
      message: "Capsule updated successfully",
      data: { capsule },
    })
  } catch (error) {
    console.error("Update capsule error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update capsule",
    })
  }
})

// @route   POST /api/capsules/:id/join
// @desc    Join capsule by invite code
// @access  Private
router.post("/:id/join", validateObjectId("id"), async (req, res) => {
  try {
    const { inviteCode } = req.body

    const capsule = await Capsule.findById(req.params.id)

    if (!capsule) {
      return res.status(404).json({
        success: false,
        message: "Capsule not found",
      })
    }

    // Check invite code for private capsules
    if (capsule.type === "private" && capsule.inviteCode !== inviteCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid invite code",
      })
    }

    // Check if user is already a contributor
    const isAlreadyContributor = capsule.contributors.some((c) => c.user.toString() === req.user._id.toString())

    if (isAlreadyContributor) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this capsule",
      })
    }

    // Add user as contributor
    capsule.contributors.push({
      user: req.user._id,
      role: "contributor",
    })

    capsule.stats.lastActivity = new Date()
    await capsule.save()

    // Add to user's joined capsules
    await User.findByIdAndUpdate(req.user._id, {
      $push: { joinedCapsules: capsule._id },
    })

    await capsule.populate("contributors.user", "name avatarUrl")

    // Emit to socket
    req.io.to(`capsule_${capsule._id}`).emit("user_joined", {
      user: req.user,
      capsule: capsule._id,
    })

    res.json({
      success: true,
      message: "Successfully joined capsule",
      data: { capsule },
    })
  } catch (error) {
    console.error("Join capsule error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to join capsule",
    })
  }
})

// @route   DELETE /api/capsules/:id/leave
// @desc    Leave capsule
// @access  Private
router.delete("/:id/leave", validateObjectId("id"), checkCapsulePermission("contributor"), async (req, res) => {
  try {
    const capsule = await Capsule.findById(req.params.id)

    // Owner cannot leave their own capsule
    if (capsule.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Capsule owner cannot leave. Transfer ownership or delete the capsule instead.",
      })
    }

    // Remove user from contributors
    capsule.contributors = capsule.contributors.filter((c) => c.user.toString() !== req.user._id.toString())

    capsule.stats.lastActivity = new Date()
    await capsule.save()

    // Remove from user's joined capsules
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { joinedCapsules: capsule._id },
    })

    // Emit to socket
    req.io.to(`capsule_${capsule._id}`).emit("user_left", {
      user: req.user,
      capsule: capsule._id,
    })

    res.json({
      success: true,
      message: "Successfully left capsule",
    })
  } catch (error) {
    console.error("Leave capsule error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to leave capsule",
    })
  }
})

// @route   GET /api/capsules/explore/public
// @desc    Get public capsules for discovery
// @access  Private
router.get("/explore/public", validatePagination, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 12
    const skip = (page - 1) * limit
    const search = req.query.search || ""

    const query = {
      type: "public",
      isActive: true,
      "settings.allowPublicDiscovery": true,
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ]
    }

    const capsules = await Capsule.find(query)
      .populate("owner", "name avatarUrl")
      .select("title description coverImage stats tags theme createdAt")
      .sort({ "stats.lastActivity": -1 })
      .skip(skip)
      .limit(limit)

    const total = await Capsule.countDocuments(query)

    res.json({
      success: true,
      data: {
        capsules,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Explore capsules error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get public capsules",
    })
  }
})

module.exports = router
