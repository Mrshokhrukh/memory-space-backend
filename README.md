# Memoryscape Backend API

A collaborative memory sharing platform built with Node.js, Express, and MongoDB.

## Features

- **User Authentication**: JWT-based authentication with registration and login
- **Memory Capsules**: Create and manage collaborative memory collections
- **Media Upload**: Support for images, videos, and audio files via Cloudinary
- **Real-time Updates**: Socket.io integration for live updates
- **API Documentation**: Complete Swagger UI documentation

## API Documentation

The API documentation is available via Swagger UI at:

- **Development**: `http://localhost:8800/api-docs`
- **Production**: `https://your-domain.com/api-docs`

### Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change user password

#### Users
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update current user profile
- `GET /api/users/stats` - Get user statistics
- `GET /api/users/:id` - Get user by ID (public profile)

#### Capsules
- `GET /api/capsules` - Get user's capsules
- `POST /api/capsules` - Create a new capsule
- `GET /api/capsules/:id` - Get capsule by ID
- `PUT /api/capsules/:id` - Update capsule
- `POST /api/capsules/:id/join` - Join capsule
- `DELETE /api/capsules/:id/leave` - Leave capsule
- `GET /api/capsules/explore/public` - Get public capsules

#### Memories
- `GET /api/memories/capsule/:capsuleId` - Get memories for a capsule
- `POST /api/memories` - Create a new memory
- `GET /api/memories/:id` - Get memory by ID
- `PUT /api/memories/:id` - Update memory
- `DELETE /api/memories/:id` - Delete memory
- `POST /api/memories/:id/react` - Add reaction to memory
- `POST /api/memories/:id/comment` - Add comment to memory
- `POST /api/memories/:id/pin` - Pin/unpin memory

#### Upload
- `POST /api/upload/media` - Upload media file
- `POST /api/upload/avatar` - Upload user avatar

#### System
- `GET /api/health` - Health check

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your configuration:
```env
PORT=8800
MONGODB_URI=mongodb://localhost:27017/memoryscape
JWT_SECRET=your-jwt-secret
CLIENT_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

4. Start the development server:
```bash
npm run dev
```

## Using Swagger UI

1. Start the server
2. Navigate to `http://localhost:8800/api-docs`
3. You'll see the interactive API documentation

### Testing Endpoints

1. **Authentication**: First, use the `/api/auth/register` or `/api/auth/login` endpoint to get a JWT token
2. **Authorize**: Click the "Authorize" button at the top of the Swagger UI and enter your JWT token
3. **Test Endpoints**: You can now test all protected endpoints directly from the Swagger UI

### Features of the Swagger UI

- **Interactive Documentation**: Test endpoints directly from the browser
- **Request/Response Examples**: See example requests and responses
- **Authentication**: Easy JWT token management
- **Schema Validation**: Automatic validation of request/response schemas
- **Filtering**: Search and filter endpoints by tags
- **Deep Linking**: Direct links to specific endpoints

## Data Models

### User
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String (hashed),
  bio: String,
  avatarUrl: String,
  createdAt: Date,
  lastActive: Date,
  createdCapsules: [ObjectId],
  joinedCapsules: [ObjectId]
}
```

### Capsule
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  type: String (public|private|timed),
  owner: ObjectId,
  contributors: [{
    user: ObjectId,
    role: String (admin|contributor|viewer)
  }],
  releaseDate: Date,
  theme: String,
  tags: [String],
  coverImage: String,
  inviteCode: String,
  isActive: Boolean,
  stats: {
    totalMemories: Number,
    lastActivity: Date
  }
}
```

### MemoryItem
```javascript
{
  _id: ObjectId,
  capsule: ObjectId,
  author: ObjectId,
  type: String (text|image|video|audio),
  title: String,
  text: String,
  mediaUrl: String,
  thumbnailUrl: String,
  mediaMetadata: Object,
  tags: [String],
  location: {
    name: String,
    coordinates: [Number]
  },
  isPinned: Boolean,
  reactions: [{
    user: ObjectId,
    emoji: String
  }],
  comments: [{
    user: ObjectId,
    text: String,
    createdAt: Date,
    replies: [{
      user: ObjectId,
      text: String,
      createdAt: Date
    }]
  }]
}
```

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:ci` - Run tests in CI mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8800` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/memoryscape` |
| `JWT_SECRET` | JWT signing secret | Required |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Required |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Required |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Required |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details. 