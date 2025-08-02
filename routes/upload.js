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

// @route   POST /api/upload/media
// @desc    Upload media file
// @access  Private
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

// @route   POST /api/upload/avatar
// @desc    Upload user avatar
// @access  Private
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
