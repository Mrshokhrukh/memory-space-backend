const { body, param, query, validationResult } = require("express-validator")

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    })
  }
  next()
}

// User validation rules
const validateUserRegistration = [
  body("name").trim().isLength({ min: 2, max: 50 }).withMessage("Name must be between 2 and 50 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain at least one lowercase letter, one uppercase letter, and one number"),
  handleValidationErrors,
]

const validateUserLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
]

// Capsule validation rules
const validateCapsuleCreation = [
  body("title").trim().isLength({ min: 1, max: 100 }).withMessage("Title must be between 1 and 100 characters"),
  body("description").optional().trim().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
  body("type").isIn(["public", "private", "timed"]).withMessage("Type must be public, private, or timed"),
  body("releaseDate")
    .if(body("type").equals("timed"))
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Release date must be in the future")
      }
      return true
    }),
  body("theme")
    .optional()
    .isIn(["default", "vintage", "modern", "nature", "space", "ocean"])
    .withMessage("Invalid theme"),
  handleValidationErrors,
]

// Memory validation rules
const validateMemoryCreation = [
  body("type").isIn(["image", "video", "audio", "text", "voice"]).withMessage("Invalid memory type"),
  body("title").optional().trim().isLength({ max: 100 }).withMessage("Title cannot exceed 100 characters"),
  body("text")
    .if(body("type").equals("text"))
    .notEmpty()
    .withMessage("Text is required for text memories")
    .isLength({ max: 2000 })
    .withMessage("Text cannot exceed 2000 characters"),
  body("text").optional().isLength({ max: 2000 }).withMessage("Text cannot exceed 2000 characters"),
  handleValidationErrors,
]

// Comment validation rules
const validateComment = [
  body("text").trim().isLength({ min: 1, max: 500 }).withMessage("Comment must be between 1 and 500 characters"),
  handleValidationErrors,
]

// Parameter validation
const validateObjectId = (paramName) => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} ID`),
  handleValidationErrors,
]

// Query validation
const validatePagination = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  handleValidationErrors,
]

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateCapsuleCreation,
  validateMemoryCreation,
  validateComment,
  validateObjectId,
  validatePagination,
  handleValidationErrors,
}
