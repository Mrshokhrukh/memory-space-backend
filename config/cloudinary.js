const cloudinary = require("cloudinary").v2

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Upload function with optimization
const uploadToCloudinary = async (file, folder = "memoryscape") => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: "auto",
      quality: "auto:good",
      fetch_format: "auto",
      transformation: [{ width: 1920, height: 1080, crop: "limit" }, { quality: "auto:good" }],
    })

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error)
    throw new Error("Failed to upload media")
  }
}

// Delete function
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId)
    return result
  } catch (error) {
    console.error("Cloudinary delete error:", error)
    throw new Error("Failed to delete media")
  }
}

// Generate video thumbnail
const generateVideoThumbnail = async (videoUrl) => {
  try {
    const result = await cloudinary.uploader.upload(videoUrl, {
      resource_type: "video",
      eager: [
        {
          width: 300,
          height: 200,
          crop: "fill",
          format: "jpg",
          start_offset: "1s",
        },
      ],
    })

    return result.eager[0].secure_url
  } catch (error) {
    console.error("Thumbnail generation error:", error)
    return null
  }
}

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  generateVideoThumbnail,
}
