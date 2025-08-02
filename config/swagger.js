const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Memoryscape API',
      version: '1.0.0',
      description: 'API documentation for Memoryscape - A collaborative memory sharing platform',
      contact: {
        name: 'Memoryscape Team',
        email: 'support@memoryscape.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:8800',
        description: 'Development server'
      },
      {
        url: 'https://memory-space-backend.onrender.com',
        description: 'Production server (Render)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            bio: { type: 'string', example: 'Memory enthusiast' },
            avatarUrl: { type: 'string', example: 'https://res.cloudinary.com/example/image/upload/v123/avatar.jpg' },
            createdAt: { type: 'string', format: 'date-time' },
            lastActive: { type: 'string', format: 'date-time' }
          }
        },
        Capsule: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439012' },
            title: { type: 'string', example: 'Summer 2023' },
            description: { type: 'string', example: 'Memories from our summer vacation' },
            type: { type: 'string', enum: ['public', 'private', 'timed'], example: 'public' },
            owner: { $ref: '#/components/schemas/User' },
            contributors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                  role: { type: 'string', enum: ['admin', 'contributor', 'viewer'] }
                }
              }
            },
            releaseDate: { type: 'string', format: 'date-time' },
            theme: { type: 'string', example: 'default' },
            tags: { type: 'array', items: { type: 'string' } },
            coverImage: { type: 'string' },
            inviteCode: { type: 'string' },
            isActive: { type: 'boolean' },
            stats: {
              type: 'object',
              properties: {
                totalMemories: { type: 'number' },
                lastActivity: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        MemoryItem: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439013' },
            capsule: { type: 'string', example: '507f1f77bcf86cd799439012' },
            author: { $ref: '#/components/schemas/User' },
            type: { type: 'string', enum: ['text', 'image', 'video', 'audio'], example: 'image' },
            title: { type: 'string', example: 'Beach Day' },
            text: { type: 'string', example: 'Amazing day at the beach!' },
            mediaUrl: { type: 'string' },
            thumbnailUrl: { type: 'string' },
            mediaMetadata: {
              type: 'object',
              properties: {
                size: { type: 'number' },
                format: { type: 'string' },
                dimensions: {
                  type: 'object',
                  properties: {
                    width: { type: 'number' },
                    height: { type: 'number' }
                  }
                }
              }
            },
            tags: { type: 'array', items: { type: 'string' } },
            location: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                coordinates: {
                  type: 'array',
                  items: { type: 'number' }
                }
              }
            },
            isPinned: { type: 'boolean' },
            reactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                  emoji: { type: 'string' }
                }
              }
            },
            comments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  user: { $ref: '#/components/schemas/User' },
                  text: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  replies: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        text: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './server.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs; 