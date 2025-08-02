const request = require("supertest")
const { app } = require("../server")
const User = require("../models/User")
const Capsule = require("../models/Capsule")
const { generateToken } = require("../middleware/auth")
const mongoose = require("mongoose")

describe("Capsule Endpoints", () => {
  let user
  let token

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/memoryscape_test")
  })

  afterAll(async () => {
    await mongoose.connection.close()
  })

  beforeEach(async () => {
    await User.deleteMany({})
    await Capsule.deleteMany({})

    user = new User({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    })
    await user.save()

    token = generateToken(user._id)
  })

  describe("POST /api/capsules", () => {
    it("should create a new capsule", async () => {
      const capsuleData = {
        title: "Test Capsule",
        description: "A test capsule",
        type: "private",
        theme: "default",
      }

      const response = await request(app)
        .post("/api/capsules")
        .set("Authorization", `Bearer ${token}`)
        .send(capsuleData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.capsule.title).toBe(capsuleData.title)
      expect(response.body.data.capsule.owner).toBe(user._id.toString())
    })

    it("should not create capsule without authentication", async () => {
      const capsuleData = {
        title: "Test Capsule",
        description: "A test capsule",
        type: "private",
      }

      const response = await request(app).post("/api/capsules").send(capsuleData).expect(401)

      expect(response.body.success).toBe(false)
    })

    it("should not create capsule without title", async () => {
      const capsuleData = {
        description: "A test capsule",
        type: "private",
      }

      const response = await request(app)
        .post("/api/capsules")
        .set("Authorization", `Bearer ${token}`)
        .send(capsuleData)
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe("GET /api/capsules", () => {
    beforeEach(async () => {
      const capsule = new Capsule({
        title: "Test Capsule",
        description: "A test capsule",
        type: "private",
        owner: user._id,
        contributors: [{ user: user._id, role: "admin" }],
      })
      await capsule.save()
    })

    it("should get user capsules", async () => {
      const response = await request(app).get("/api/capsules").set("Authorization", `Bearer ${token}`).expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.capsules).toHaveLength(1)
      expect(response.body.data.capsules[0].title).toBe("Test Capsule")
    })

    it("should not get capsules without authentication", async () => {
      const response = await request(app).get("/api/capsules").expect(401)

      expect(response.body.success).toBe(false)
    })
  })
})
