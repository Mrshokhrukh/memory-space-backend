const Analytics = require("../models/Analytics")

const trackEvent = async (req, res, next) => {
  try {
    // Skip tracking for health checks and static files
    if (req.path === "/health" || req.path.startsWith("/static")) {
      return next()
    }

    const eventData = {
      userId: req.user?.id || null,
      sessionId: req.sessionID || req.headers["x-session-id"],
      event: getEventType(req),
      path: req.path,
      method: req.method,
      userAgent: req.headers["user-agent"],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date(),
      metadata: {
        referer: req.headers.referer,
        query: req.query,
        body: sanitizeBody(req.body),
      },
    }

    // Don't wait for analytics to complete
    setImmediate(async () => {
      try {
        await Analytics.create(eventData)
      } catch (error) {
        console.error("Analytics tracking error:", error)
      }
    })

    next()
  } catch (error) {
    // Don't let analytics errors break the request
    console.error("Analytics middleware error:", error)
    next()
  }
}

const getEventType = (req) => {
  const { method, path } = req

  if (path.includes("/auth/login")) return "user_login"
  if (path.includes("/auth/register")) return "user_register"
  if (path.includes("/capsules") && method === "POST") return "capsule_create"
  if (path.includes("/memories") && method === "POST") return "memory_create"
  if (path.includes("/upload")) return "file_upload"
  if (path.includes("/ai/")) return "ai_request"

  return "api_request"
}

const sanitizeBody = (body) => {
  if (!body) return null

  const sanitized = { ...body }

  // Remove sensitive fields
  delete sanitized.password
  delete sanitized.token
  delete sanitized.secret

  // Truncate large text fields
  if (sanitized.text && sanitized.text.length > 200) {
    sanitized.text = sanitized.text.substring(0, 200) + "..."
  }

  return sanitized
}

const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, event, userId } = req.query

    const filter = {}

    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }

    if (event) filter.event = event
    if (userId) filter.userId = userId

    const analytics = await Analytics.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            event: "$event",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          event: "$_id.event",
          date: "$_id.date",
          count: 1,
          uniqueUsers: { $size: "$uniqueUsers" },
        },
      },
      { $sort: { date: -1 } },
    ])

    res.json({
      success: true,
      data: { analytics },
    })
  } catch (error) {
    console.error("Get analytics error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
    })
  }
}

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const [todayStats, yesterdayStats, weekStats, topEvents, userGrowth] = await Promise.all([
      // Today's stats
      Analytics.aggregate([
        {
          $match: {
            timestamp: { $gte: yesterday, $lt: today },
          },
        },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" },
            uniqueSessions: { $addToSet: "$sessionId" },
          },
        },
      ]),

      // Yesterday's stats
      Analytics.aggregate([
        {
          $match: {
            timestamp: {
              $gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
              $lt: yesterday,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" },
          },
        },
      ]),

      // Week stats
      Analytics.aggregate([
        {
          $match: {
            timestamp: { $gte: weekAgo },
          },
        },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" },
          },
        },
      ]),

      // Top events
      Analytics.aggregate([
        {
          $match: {
            timestamp: { $gte: weekAgo },
          },
        },
        {
          $group: {
            _id: "$event",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // User growth over time
      Analytics.aggregate([
        {
          $match: {
            event: "user_register",
            timestamp: { $gte: weekAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            newUsers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ])

    const stats = {
      today: todayStats[0] || { totalEvents: 0, uniqueUsers: [], uniqueSessions: [] },
      yesterday: yesterdayStats[0] || { totalEvents: 0, uniqueUsers: [] },
      week: weekStats[0] || { totalEvents: 0, uniqueUsers: [] },
      topEvents,
      userGrowth,
    }

    // Calculate growth percentages
    stats.growth = {
      events: calculateGrowth(stats.today.totalEvents, stats.yesterday.totalEvents),
      users: calculateGrowth(stats.today.uniqueUsers.length, stats.yesterday.uniqueUsers.length),
    }

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error("Get dashboard stats error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
    })
  }
}

const calculateGrowth = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

module.exports = {
  trackEvent,
  getAnalytics,
  getDashboardStats,
}
