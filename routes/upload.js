const express = require("express")
const multer = require("multer")
const path = require("path")
const { uploadToCloudinary, generateVideoThumbnail } = require("../config/cloudinary")

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    "image/jpeg": true,
    "image/jpg": true,
    "image/png": true,
    "image/gif": true,
    "image/webp": true,
    "video/mp4": true,
    "video/mpeg": true,
    "video/quicktime": true,
    "video/webm": true,
    "audio/mpeg": true,
    "audio/wav": true,
    "audio/ogg": true,
    "audio/mp3": true,
  }

  if (allowedTypes[file.mimetype]) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only images, videos, and audio files are allowed."), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
})

/**
 * @swagger
 * /api/upload/media:
 *   post:
 *     summary: Upload media file
 *     description: Upload a media file (image, video, audio) to Cloudinary
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - capsuleId
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Media file to upload (max 100MB)
 *               capsuleId:
 *                 type: string
 *                 pattern: '^[0-9a-fA-F]{24}$'
 *                 description: ID of the capsule to associate the upload with
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: File uploaded successfully
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
 *                   example: "File uploaded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: URL of the uploaded file
 *                       example: "https://res.cloudinary.com/example/image/upload/v123/file.jpg"
 *                     thumbnailUrl:
 *                       type: string
 *                       description: URL of the thumbnail (for videos)
 *                       example: "https://res.cloudinary.com/example/image/upload/v123/thumb.jpg"
 *                     publicId:
 *                       type: string
 *                       description: Cloudinary public ID
 *                       example: "memoryscape/capsules/507f1f77bcf86cd799439012/file"
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         size:
 *                           type: number
 *                           example: 1024000
 *                         format:
 *                           type: string
 *                           example: "jpg"
 *                         dimensions:
 *                           type: object
 *                           properties:
 *                             width:
 *                               type: number
 *                               example: 1920
 *                             height:
 *                               type: number
 *                               example: 1080
 *       400:
 *         description: Bad request - no file or invalid capsule ID
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
router.post("/media", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      })
    }

    const { capsuleId } = req.body

    if (!capsuleId) {
      return res.status(400).json({
        success: false,
        message: "Capsule ID is required",
      })
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file, `memoryscape/capsules/${capsuleId}`)

    let thumbnailUrl = null

    // Generate thumbnail for videos
    if (req.file.mimetype.startsWith("video/")) {
      thumbnailUrl = await generateVideoThumbnail(uploadResult.url)
    }

    // Prepare metadata
    const mediaMetadata = {
      size: uploadResult.bytes,
      format: uploadResult.format,
      dimensions: {
        width: uploadResult.width,
        height: uploadResult.height,
      },
    }

    res.json({
      success: true,
      message: "File uploaded successfully",
      data: {
        url: uploadResult.url,
        thumbnailUrl,
        publicId: uploadResult.publicId,
        metadata: mediaMetadata,
      },
    })
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload file",
    })
  }
})

/**
 * @swagger
 * /api/upload/avatar:
 *   post:
 *     summary: Upload user avatar
 *     description: Upload a user avatar image to Cloudinary
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file to upload (max 100MB)
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
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
 *                   example: "Avatar uploaded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatarUrl:
 *                       type: string
 *                       description: URL of the uploaded avatar
 *                       example: "https://res.cloudinary.com/example/image/upload/v123/avatar.jpg"
 *       400:
 *         description: Bad request - no file or invalid file type
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
router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      })
    }

    // Only allow images for avatars
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "Only image files are allowed for avatars",
      })
    }

    // Upload to Cloudinary with avatar-specific transformations
    const uploadResult = await uploadToCloudinary(req.file, `memoryscape/avatars`)

    // Update user avatar
    const User = require("../models/User")
    await User.findByIdAndUpdate(req.user._id, {
      avatarUrl: uploadResult.url,
    })

    res.json({
      success: true,
      message: "Avatar uploaded successfully",
      data: {
        avatarUrl: uploadResult.url,
      },
    })
  } catch (error) {
    console.error("Avatar upload error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to upload avatar",
    })
  }
})

module.exports = router
