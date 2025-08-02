const request = require("supertest")
const { app } = require("../server")
const User = require("../models/User")
const mongoose = require("mongoose")

describe("Auth Endpoints", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/memoryscape_test")
  })

  afterAll(async () => {
    await mongoose.connection.close()
  })

  beforeEach(async () => {
    await User.deleteMany({})
  })

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      }

      const response = await request(app).post("/api/auth/register").send(userData).expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user.email).toBe(userData.email)
      expect(response.body.data.token).toBeDefined()
    })

    it("should not register user with invalid email", async () => {
      const userData = {
        name: "Test User",
        email: "invalid-email",
        password: "password123",
      }

      const response = await request(app).post("/api/auth/register").send(userData).expect(400)

      expect(response.body.success).toBe(false)
    })

    it("should not register user with short password", async () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "123",
      }

      const response = await request(app).post("/api/auth/register").send(userData).expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      const user = new User({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      })
      await user.save()
    })

    it("should login with valid credentials", async () => {
      const credentials = {
        email: "test@example.com",
        password: "password123",
      }

      const response = await request(app).post("/api/auth/login").send(credentials).expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
    })

    it("should not login with invalid credentials", async () => {
      const credentials = {
        email: "test@example.com",
        password: "wrongpassword",
      }

      const response = await request(app).post("/api/auth/login").send(credentials).expect(401)

      expect(response.body.success).toBe(false)
    })
  })
})
