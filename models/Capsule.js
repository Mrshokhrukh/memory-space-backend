const mongoose = require("mongoose")

const capsuleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Capsule title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    type: {
      type: String,
      enum: ["public", "private", "timed"],
      default: "private",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contributors: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        role: {
          type: String,
          enum: ["admin", "contributor", "viewer"],
          default: "contributor",
        },
      },
    ],
    content: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MemoryItem",
      },
    ],
    releaseDate: {
      type: Date,
      required: function () {
        return this.type === "timed"
      },
    },
    theme: {
      type: String,
      enum: ["default", "vintage", "modern", "nature", "space", "ocean"],
      default: "default",
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    coverImage: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    settings: {
      allowPublicDiscovery: {
        type: Boolean,
        default: false,
      },
      requireApproval: {
        type: Boolean,
        default: false,
      },
      allowComments: {
        type: Boolean,
        default: true,
      },
      allowReactions: {
        type: Boolean,
        default: true,
      },
    },
    stats: {
      totalMemories: {
        type: Number,
        default: 0,
      },
      totalContributors: {
        type: Number,
        default: 1,
      },
      lastActivity: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  },
)

// Generate unique invite code
capsuleSchema.pre("save", function (next) {
  if (!this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
  next()
})

// Update stats before saving
capsuleSchema.pre("save", function (next) {
  this.stats.totalContributors = this.contributors.length
  next()
})

module.exports = mongoose.model("Capsule", capsuleSchema)
