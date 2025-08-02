const express = require("express")
const router = express.Router()
const aiService = require("../services/aiService")
const auth = require("../middleware/auth")
const rateLimit = require("express-rate-limit")

// Rate limiting for AI endpoints
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    success: false,
    message: "Too many AI requests, please try again later",
  },
})

// @route   POST /api/ai/generate-title
// @desc    Generate AI title for memory
// @access  Private
router.post("/generate-title", [auth, aiRateLimit], async (req, res) => {
  try {
    const { text, type } = req.body

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Text content is required",
      })
    }

    const title = await aiService.generateTitle(text, type)

    if (!title) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate title",
      })
    }

    res.json({
      success: true,
      data: { title },
    })
  } catch (error) {
    console.error("Generate title error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @route   POST /api/ai/analyze-mood
// @desc    Analyze mood of text content
// @access  Private
router.post("/analyze-mood", [auth, aiRateLimit], async (req, res) => {
  try {
    const { text } = req.body

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Text content is required",
      })
    }

    const mood = await aiService.analyzeMood(text)

    res.json({
      success: true,
      data: { mood },
    })
  } catch (error) {
    console.error("Analyze mood error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @route   POST /api/ai/enhance-text
// @desc    Enhance text content with AI
// @access  Private
router.post("/enhance-text", [auth, aiRateLimit], async (req, res) => {
  try {
    const { text } = req.body

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Text content is required",
      })
    }

    if (text.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Text too long for enhancement (max 2000 characters)",
      })
    }

    const enhancedText = await aiService.enhanceText(text)

    res.json({
      success: true,
      data: { enhancedText },
    })
  } catch (error) {
    console.error("Enhance text error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @route   POST /api/ai/generate-tags
// @desc    Generate relevant tags for content
// @access  Private
router.post("/generate-tags", [auth, aiRateLimit], async (req, res) => {
  try {
    const { text, existingTags = [] } = req.body

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Text content is required",
      })
    }

    const tags = await aiService.generateTags(text, existingTags)

    res.json({
      success: true,
      data: { tags },
    })
  } catch (error) {
    console.error("Generate tags error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @route   POST /api/ai/capsule-summary
// @desc    Generate summary for capsule memories
// @access  Private
router.post("/capsule-summary", [auth, aiRateLimit], async (req, res) => {
  try {
    const { memories } = req.body

    if (!memories || !Array.isArray(memories) || memories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Memories array is required",
      })
    }

    const summary = await aiService.generateSummary(memories)

    if (!summary) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate summary",
      })
    }

    res.json({
      success: true,
      data: { summary },
    })
  } catch (error) {
    console.error("Generate summary error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @route   POST /api/ai/capsule-insights
// @desc    Generate insights for capsule
// @access  Private
router.post("/capsule-insights", [auth, aiRateLimit], async (req, res) => {
  try {
    const { capsule, memories } = req.body

    if (!capsule || !memories) {
      return res.status(400).json({
        success: false,
        message: "Capsule and memories data required",
      })
    }

    const insights = await aiService.generateCapsuleInsights(capsule, memories)

    res.json({
      success: true,
      data: { insights },
    })
  } catch (error) {
    console.error("Generate insights error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

module.exports = router
