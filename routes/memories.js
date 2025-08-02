const express = require("express")
const MemoryItem = require("../models/MemoryItem")
const Capsule = require("../models/Capsule")
const { checkCapsulePermission } = require("../middleware/auth")
const {
  validateMemoryCreation,
  validateComment,
  validateObjectId,
  validatePagination,
} = require("../middleware/validation")

const router = express.Router()

// @route   GET /api/memories/capsule/:capsuleId
// @desc    Get memories for a capsule
// @access  Private
router.get(
  "/capsule/:capsuleId",
  validateObjectId("capsuleId"),
  checkCapsulePermission("viewer"),
  validatePagination,
  async (req, res) => {
    try {
      const page = Number.parseInt(req.query.page) || 1
      const limit = Number.parseInt(req.query.limit) || 20
      const skip = (page - 1) * limit
      const type = req.query.type // Filter by memory type

      const query = { capsule: req.params.capsuleId }
      if (type) query.type = type

      const memories = await MemoryItem.find(query)
        .populate("author", "name avatarUrl")
        .populate("comments.user", "name avatarUrl")
        .populate("reactions.user", "name avatarUrl")
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)

      const total = await MemoryItem.countDocuments(query)

      res.json({
        success: true,
        data: {
          memories,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      })
    } catch (error) {
      console.error("Get memories error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to get memories",
      })
    }
  },
)

// @route   POST /api/memories
// @desc    Create a new memory
// @access  Private
router.post("/", validateMemoryCreation, async (req, res) => {
  try {
    const { capsuleId, type, title, text, mediaUrl, thumbnailUrl, mediaMetadata, tags, location } = req.body

    // Check if user has permission to add memories to this capsule
    const capsule = await Capsule.findById(capsuleId)
    if (!capsule) {
      return res.status(404).json({
        success: false,
        message: "Capsule not found",
      })
    }

    // Check if user is contributor
    const isContributor =
      capsule.owner.toString() === req.user._id.toString() ||
      capsule.contributors.some((c) => c.user.toString() === req.user._id.toString())

    if (!isContributor) {
      return res.status(403).json({
        success: false,
        message: "Access denied - not a capsule member",
      })
    }

    const memory = new MemoryItem({
      capsule: capsuleId,
      author: req.user._id,
      type,
      title,
      text,
      mediaUrl,
      thumbnailUrl,
      mediaMetadata,
      tags: tags || [],
      location,
    })

    await memory.save()

    // Update capsule stats
    await Capsule.findByIdAndUpdate(capsuleId, {
      $push: { content: memory._id },
      $inc: { "stats.totalMemories": 1 },
      $set: { "stats.lastActivity": new Date() },
    })

    await memory.populate("author", "name avatarUrl")

    // Emit to socket
    req.io.to(`capsule_${capsuleId}`).emit("new_memory", {
      memory,
      capsule: capsuleId,
    })

    res.status(201).json({
      success: true,
      message: "Memory created successfully",
      data: { memory },
    })
  } catch (error) {
    console.error("Create memory error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create memory",
    })
  }
})

// @route   GET /api/memories/:id
// @desc    Get memory by ID
// @access  Private
router.get("/:id", validateObjectId("id"), async (req, res) => {
  try {
    const memory = await MemoryItem.findById(req.params.id)
      .populate("author", "name avatarUrl bio")
      .populate("comments.user", "name avatarUrl")
      .populate("comments.replies.user", "name avatarUrl")
      .populate("reactions.user", "name avatarUrl")

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      })
    }

    // Check if user has access to the capsule
    const capsule = await Capsule.findById(memory.capsule)
    const hasAccess =
      capsule.owner.toString() === req.user._id.toString() ||
      capsule.contributors.some((c) => c.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    res.json({
      success: true,
      data: { memory },
    })
  } catch (error) {
    console.error("Get memory error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get memory",
    })
  }
})

// @route   PUT /api/memories/:id
// @desc    Update memory
// @access  Private (Author only)
router.put("/:id", validateObjectId("id"), async (req, res) => {
  try {
    const { title, text, tags } = req.body

    const memory = await MemoryItem.findById(req.params.id)

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      })
    }

    // Only author can edit their memory
    if (memory.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you can only edit your own memories",
      })
    }

    if (title !== undefined) memory.title = title
    if (text !== undefined) memory.text = text
    if (tags) memory.tags = tags

    await memory.save()
    await memory.populate("author", "name avatarUrl")

    // Emit to socket
    req.io.to(`capsule_${memory.capsule}`).emit("memory_updated", {
      memory,
      updatedBy: req.user,
    })

    res.json({
      success: true,
      message: "Memory updated successfully",
      data: { memory },
    })
  } catch (error) {
    console.error("Update memory error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update memory",
    })
  }
})

// @route   DELETE /api/memories/:id
// @desc    Delete memory
// @access  Private (Author or Capsule Admin)
router.delete("/:id", validateObjectId("id"), async (req, res) => {
  try {
    const memory = await MemoryItem.findById(req.params.id)

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      })
    }

    // Check if user can delete (author or capsule admin/owner)
    const capsule = await Capsule.findById(memory.capsule)
    const isAuthor = memory.author.toString() === req.user._id.toString()
    const isOwner = capsule.owner.toString() === req.user._id.toString()
    const isAdmin = capsule.contributors.some(
      (c) => c.user.toString() === req.user._id.toString() && c.role === "admin",
    )

    if (!isAuthor && !isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    await MemoryItem.findByIdAndDelete(req.params.id)

    // Update capsule stats
    await Capsule.findByIdAndUpdate(memory.capsule, {
      $pull: { content: memory._id },
      $inc: { "stats.totalMemories": -1 },
      $set: { "stats.lastActivity": new Date() },
    })

    // Emit to socket
    req.io.to(`capsule_${memory.capsule}`).emit("memory_deleted", {
      memoryId: memory._id,
      capsule: memory.capsule,
      deletedBy: req.user,
    })

    res.json({
      success: true,
      message: "Memory deleted successfully",
    })
  } catch (error) {
    console.error("Delete memory error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete memory",
    })
  }
})

// @route   POST /api/memories/:id/react
// @desc    Add reaction to memory
// @access  Private
router.post("/:id/react", validateObjectId("id"), async (req, res) => {
  try {
    const { emoji } = req.body

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: "Emoji is required",
      })
    }

    const memory = await MemoryItem.findById(req.params.id)

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      })
    }

    // Check if user already reacted with this emoji
    const existingReaction = memory.reactions.find(
      (r) => r.user.toString() === req.user._id.toString() && r.emoji === emoji,
    )

    if (existingReaction) {
      // Remove reaction if it exists
      memory.reactions = memory.reactions.filter(
        (r) => !(r.user.toString() === req.user._id.toString() && r.emoji === emoji),
      )
    } else {
      // Add new reaction
      memory.reactions.push({
        user: req.user._id,
        emoji,
      })
    }

    await memory.save()
    await memory.populate("reactions.user", "name avatarUrl")

    // Emit to socket
    req.io.to(`capsule_${memory.capsule}`).emit("memory_reaction", {
      memoryId: memory._id,
      reaction: { user: req.user, emoji },
      action: existingReaction ? "removed" : "added",
    })

    res.json({
      success: true,
      message: existingReaction ? "Reaction removed" : "Reaction added",
      data: { reactions: memory.reactions },
    })
  } catch (error) {
    console.error("React to memory error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to react to memory",
    })
  }
})

// @route   POST /api/memories/:id/comment
// @desc    Add comment to memory
// @access  Private
router.post("/:id/comment", validateObjectId("id"), validateComment, async (req, res) => {
  try {
    const { text } = req.body

    const memory = await MemoryItem.findById(req.params.id)

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      })
    }

    const comment = {
      user: req.user._id,
      text,
      replies: [],
    }

    memory.comments.push(comment)
    await memory.save()

    await memory.populate("comments.user", "name avatarUrl")
    const newComment = memory.comments[memory.comments.length - 1]

    // Emit to socket
    req.io.to(`capsule_${memory.capsule}`).emit("new_comment", {
      memoryId: memory._id,
      comment: newComment,
    })

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: { comment: newComment },
    })
  } catch (error) {
    console.error("Add comment error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to add comment",
    })
  }
})

// @route   POST /api/memories/:id/pin
// @desc    Pin/unpin memory
// @access  Private (Capsule Admin/Owner only)
router.post("/:id/pin", validateObjectId("id"), async (req, res) => {
  try {
    const memory = await MemoryItem.findById(req.params.id)

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      })
    }

    // Check if user is capsule admin/owner
    const capsule = await Capsule.findById(memory.capsule)
    const isOwner = capsule.owner.toString() === req.user._id.toString()
    const isAdmin = capsule.contributors.some(
      (c) => c.user.toString() === req.user._id.toString() && c.role === "admin",
    )

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied - admin privileges required",
      })
    }

    memory.isPinned = !memory.isPinned
    await memory.save()

    // Emit to socket
    req.io.to(`capsule_${memory.capsule}`).emit("memory_pinned", {
      memoryId: memory._id,
      isPinned: memory.isPinned,
      pinnedBy: req.user,
    })

    res.json({
      success: true,
      message: memory.isPinned ? "Memory pinned" : "Memory unpinned",
      data: { isPinned: memory.isPinned },
    })
  } catch (error) {
    console.error("Pin memory error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to pin memory",
    })
  }
})

module.exports = router
