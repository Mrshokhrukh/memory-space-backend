const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["capsule_invite", "new_memory", "new_comment", "new_reaction", "capsule_shared", "user_joined"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedCapsule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Capsule",
    },
    relatedMemory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemoryItem",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    actionUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 })

module.exports = mongoose.model("Notification", notificationSchema)
