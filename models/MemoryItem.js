const mongoose = require("mongoose")

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: [500, "Comment cannot exceed 500 characters"],
    },
    replies: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        text: {
          type: String,
          maxlength: [300, "Reply cannot exceed 300 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

const memoryItemSchema = new mongoose.Schema(
  {
    capsule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Capsule",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["image", "video", "audio", "text", "voice"],
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    text: {
      type: String,
      maxlength: [2000, "Text cannot exceed 2000 characters"],
    },
    mediaUrl: {
      type: String,
      required: function () {
        return ["image", "video", "audio", "voice"].includes(this.type)
      },
    },
    thumbnailUrl: {
      type: String, // For videos
    },
    mediaMetadata: {
      size: Number,
      duration: Number, // For audio/video
      dimensions: {
        width: Number,
        height: Number,
      },
      format: String,
    },
    reactions: [reactionSchema],
    comments: [commentSchema],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    location: {
      name: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    aiGenerated: {
      autoTitle: String,
      summary: String,
      mood: String,
      generatedAt: Date,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
memoryItemSchema.index({ capsule: 1, createdAt: -1 })
memoryItemSchema.index({ author: 1 })
memoryItemSchema.index({ type: 1 })

module.exports = mongoose.model("MemoryItem", memoryItemSchema)
