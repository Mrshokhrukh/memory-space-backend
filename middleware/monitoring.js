const os = require("os")
const process = require("process")

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      memory: [],
      cpu: [],
    }

    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics()
    }, 30000)
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    this.metrics.memory.push({
      timestamp: new Date(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    })

    this.metrics.cpu.push({
      timestamp: new Date(),
      user: cpuUsage.user,
      system: cpuUsage.system,
    })

    // Keep only last 100 entries
    if (this.metrics.memory.length > 100) {
      this.metrics.memory = this.metrics.memory.slice(-100)
    }
    if (this.metrics.cpu.length > 100) {
      this.metrics.cpu = this.metrics.cpu.slice(-100)
    }
  }

  middleware() {
    return (req, res, next) => {
      const startTime = Date.now()

      // Increment request counter
      this.metrics.requests++

      // Override res.end to capture response time
      const originalEnd = res.end
      res.end = (...args) => {
        const responseTime = Date.now() - startTime

        // Record response time
        this.metrics.responseTime.push({
          timestamp: new Date(),
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
        })

        // Keep only last 1000 response times
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime = this.metrics.responseTime.slice(-1000)
        }

        // Count errors (4xx and 5xx status codes)
        if (res.statusCode >= 400) {
          this.metrics.errors++
        }

        // Call original end method
        originalEnd.apply(res, args)
      }

      next()
    }
  }

  getMetrics() {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    // Filter recent response times (last hour)
    const recentResponseTimes = this.metrics.responseTime
      .filter((rt) => rt.timestamp.getTime() > oneHourAgo)
      .map((rt) => rt.responseTime)

    const avgResponseTime =
      recentResponseTimes.length > 0 ? recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length : 0

    const maxResponseTime = recentResponseTimes.length > 0 ? Math.max(...recentResponseTimes) : 0

    // Get latest system metrics
    const latestMemory = this.metrics.memory[this.metrics.memory.length - 1]
    const latestCpu = this.metrics.cpu[this.metrics.cpu.length - 1]

    return {
      requests: {
        total: this.metrics.requests,
        errors: this.metrics.errors,
        errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) * 100 : 0,
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        maxResponseTime,
        requestsLastHour: this.metrics.responseTime.filter((rt) => rt.timestamp.getTime() > oneHourAgo).length,
      },
      system: {
        memory: latestMemory
          ? {
              rss: Math.round(latestMemory.rss / 1024 / 1024), // MB
              heapUsed: Math.round(latestMemory.heapUsed / 1024 / 1024), // MB
              heapTotal: Math.round(latestMemory.heapTotal / 1024 / 1024), // MB
            }
          : null,
        cpu: latestCpu,
        uptime: Math.round(process.uptime()),
        loadAverage: os.loadavg(),
        platform: os.platform(),
        nodeVersion: process.version,
      },
      timestamp: new Date(),
    }
  }

  getHealthStatus() {
    const metrics = this.getMetrics()
    const issues = []

    // Check error rate
    if (metrics.requests.errorRate > 5) {
      issues.push(`High error rate: ${metrics.requests.errorRate.toFixed(2)}%`)
    }

    // Check response time
    if (metrics.performance.avgResponseTime > 1000) {
      issues.push(`Slow response time: ${metrics.performance.avgResponseTime}ms`)
    }

    // Check memory usage
    if (metrics.system.memory && metrics.system.memory.heapUsed > 500) {
      issues.push(`High memory usage: ${metrics.system.memory.heapUsed}MB`)
    }

    return {
      status: issues.length === 0 ? "healthy" : "warning",
      issues,
      metrics,
    }
  }
}

const monitor = new PerformanceMonitor()

// Health check endpoint
const healthCheck = (req, res) => {
  const health = monitor.getHealthStatus()

  res.status(health.status === "healthy" ? 200 : 503).json({
    success: true,
    data: health,
  })
}

// Metrics endpoint
const getMetrics = (req, res) => {
  const metrics = monitor.getMetrics()

  res.json({
    success: true,
    data: metrics,
  })
}

module.exports = {
  monitor,
  healthCheck,
  getMetrics,
  middleware: monitor.middleware(),
}
