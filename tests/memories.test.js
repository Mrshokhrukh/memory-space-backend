const request = require("supertest")
const { app } = require("../server")
const User = require("../models/User")
const Capsule = require("../models/Capsule")
const MemoryItem = require("../models/MemoryItem")
const { generateToken } = require("../middleware/auth")
const mongoose = require("mongoose")

describe("Memory Endpoints", () => {
  let user
  let token
  let capsule

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/memoryscape_test")
  })

  afterAll(async () => {
    await mongoose.connection.close()
  })

  beforeEach(async () => {
    await User.deleteMany({})
    await Capsule.deleteMany({})
    await MemoryItem.deleteMany({})

    user = new User({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    })
    await user.save()

    token = generateToken(user._id)

    capsule = new Capsule({
      title: "Test Capsule",
      description: "A test capsule",
      type: "private",
      owner: user._id,
      contributors: [{ user: user._id, role: "admin" }],
    })
    await capsule.save()
  })

  describe("POST /api/memories", () => {
    it("should create a text memory", async () => {
      const memoryData = {
        capsuleId: capsule._id,
        type: "text",
        title: "Test Memory",
        text: "This is a test memory",
        tags: ["test", "memory"],
      }

      const response = await request(app)
        .post("/api/memories")
        .set("Authorization", `Bearer ${token}`)
        .send(memoryData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.memory.title).toBe(memoryData.title)
      expect(response.body.data.memory.author).toBe(user._id.toString())
    })

    it("should not create memory without authentication", async () => {
      const memoryData = {
        capsuleId: capsule._id,
        type: "text",
        text: "This is a test memory",
      }

      const response = await request(app).post("/api/memories").send(memoryData).expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe("GET /api/memories/capsule/:capsuleId", () => {
    beforeEach(async () => {
      const memory = new MemoryItem({
        capsule: capsule._id,
        author: user._id,
        type: "text",
        title: "Test Memory",
        text: "This is a test memory",
      })
      await memory.save()
    })

    it("should get capsule memories", async () => {
      const response = await request(app)
        .get(`/api/memories/capsule/${capsule._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.memories).toHaveLength(1)
      expect(response.body.data.memories[0].title).toBe("Test Memory")
    })
  })

  describe("POST /api/memories/:id/react", () => {
    let memory

    beforeEach(async () => {
      memory = new MemoryItem({
        capsule: capsule._id,
        author: user._id,
        type: "text",
        title: "Test Memory",
        text: "This is a test memory",
      })
      await memory.save()
    })

    it("should add reaction to memory", async () => {
      const response = await request(app)
        .post(`/api/memories/${memory._id}/react`)
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "❤️" })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.reactions).toHaveLength(1)
      expect(response.body.data.reactions[0].emoji).toBe("❤️")
    })
  })
})
