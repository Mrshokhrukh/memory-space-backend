const express = require("express")
const Capsule = require("../models/Capsule")
const MemoryItem = require("../models/MemoryItem")
const User = require("../models/User")
const { checkCapsulePermission } = require("../middleware/auth")
const { validateCapsuleCreation, validateObjectId, validatePagination } = require("../middleware/validation")

const router = express.Router()

/**
 * @swagger
 * /api/capsules:
 *   get:
 *     summary: Get user's capsules
 *     description: Retrieve all capsules where the user is owner or contributor
 *     tags: [Capsules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Capsules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     capsules:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Capsule'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                         total:
 *                           type: integer
 *                           example: 25
 *                         pages:
 *                           type: integer
 *                           example: 3
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/capsules:
 *   post:
 *     summary: Create a new capsule
 *     description: Create a new memory capsule
 *     tags: [Capsules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *                 description: Capsule title
 *                 example: "Summer 2023"
 *               description:
 *                 type: string
 *                 description: Capsule description
 *                 example: "Memories from our summer vacation"
 *               type:
 *                 type: string
 *                 enum: [public, private, timed]
 *                 description: Capsule type
 *                 example: "public"
 *               releaseDate:
 *                 type: string
 *                 format: date-time
 *                 description: Release date for timed capsules
 *                 example: "2024-12-31T23:59:59.000Z"
 *               theme:
 *                 type: string
 *                 description: Capsule theme
 *                 example: "default"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Capsule tags
 *                 example: ["summer", "vacation", "family"]
 *     responses:
 *       201:
 *         description: Capsule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Capsule created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     capsule:
 *                       $ref: '#/components/schemas/Capsule'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/capsules/{id}:
 *   get:
 *     summary: Get capsule by ID
 *     description: Retrieve a specific capsule by its ID
 *     tags: [Capsules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Capsule ID
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Capsule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     capsule:
 *                       $ref: '#/components/schemas/Capsule'
 *                     userRole:
 *                       type: string
 *                       enum: [owner, admin, contributor, viewer]
 *                       description: User's role in this capsule
 *       400:
 *         description: Bad request - invalid capsule ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - no access to capsule
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Capsule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/capsules/{id}:
 *   put:
 *     summary: Update capsule
 *     description: Update a capsule (admin/owner only)
 *     tags: [Capsules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Capsule ID
 *         example: "507f1f77bcf86cd799439012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Capsule title
 *                 example: "Updated Summer 2023"
 *               description:
 *                 type: string
 *                 description: Capsule description
 *                 example: "Updated memories from our summer vacation"
 *               theme:
 *                 type: string
 *                 description: Capsule theme
 *                 example: "ocean"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Capsule tags
 *                 example: ["summer", "vacation", "family", "beach"]
 *               settings:
 *                 type: object
 *                 description: Capsule settings
 *                 properties:
 *                   allowPublicDiscovery:
 *                     type: boolean
 *                     example: true
 *                   allowComments:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: Capsule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Capsule updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     capsule:
 *                       $ref: '#/components/schemas/Capsule'
 *       400:
 *         description: Bad request - invalid capsule ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Capsule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/capsules/{id}/join:
 *   post:
 *     summary: Join capsule
 *     description: Join a capsule using invite code
 *     tags: [Capsules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Capsule ID
 *         example: "507f1f77bcf86cd799439012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inviteCode
 *             properties:
 *               inviteCode:
 *                 type: string
 *                 description: Invite code for private capsules
 *                 example: "SUMMER2023"
 *     responses:
 *       200:
 *         description: Successfully joined capsule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully joined capsule"
 *                 data:
 *                   type: object
 *                   properties:
 *                     capsule:
 *                       $ref: '#/components/schemas/Capsule'
 *       400:
 *         description: Bad request - invalid capsule ID or invite code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Capsule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/capsules/{id}/leave:
 *   delete:
 *     summary: Leave capsule
 *     description: Leave a capsule (cannot leave if you are the owner)
 *     tags: [Capsules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Capsule ID
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Successfully left capsule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully left capsule"
 *       400:
 *         description: Bad request - invalid capsule ID or owner cannot leave
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - not a capsule member
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/capsules/explore/public:
 *   get:
 *     summary: Get public capsules for discovery
 *     description: Retrieve public capsules that allow public discovery
 *     tags: [Capsules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 12
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for capsule title, description, or tags
 *     responses:
 *       200:
 *         description: Public capsules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     capsules:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Capsule'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 12
 *                         total:
 *                           type: integer
 *                           example: 45
 *                         pages:
 *                           type: integer
 *                           example: 4
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
