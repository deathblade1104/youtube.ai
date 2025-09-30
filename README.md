# YouTube Clone Backend

A microservices-based backend system for a YouTube clone application, built with NestJS and TypeScript. This project implements a distributed architecture with separate services for different functionalities.

## 🏗️ Architecture Overview

The backend consists of three main microservices:

### 1. **User Service** (Port: 8080)
- **Purpose**: Handles user authentication, registration, and user management
- **Features**:
  - User registration and login
  - JWT-based authentication
  - User profile management
  - Password hashing with bcrypt
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis for session management

### 2. **Upload Service** (Port: 8081)
- **Purpose**: Manages video file uploads and processing
- **Features**:
  - Video file upload to AWS S3
  - File validation and processing
  - Kafka message publishing for video processing events
  - Health monitoring
- **Storage**: AWS S3 for file storage
- **Message Queue**: Kafka for event-driven processing

### 3. **Transcoder Service** (Kafka Consumer)
- **Purpose**: Handles video transcription and processing
- **Features**:
  - Kafka event consumption for video processing
  - Video transcription services
  - Asynchronous video processing
- **Communication**: Kafka microservice pattern

## 🚀 Technology Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis
- **Message Queue**: Kafka
- **Cloud Storage**: AWS S3
- **Authentication**: JWT with Passport
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

## 📁 Project Structure

```
backend/
├── user-service/          # User management service
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/      # Authentication module
│   │   │   ├── user/      # User management
│   │   │   └── health/    # Health checks
│   │   ├── database/      # Database configuration
│   │   └── common/        # Shared utilities
│   └── package.json
├── upload-service/        # File upload service
│   ├── src/
│   │   ├── modules/
│   │   │   ├── upload/    # File upload handling
│   │   │   └── health/    # Health checks
│   │   └── providers/     # Infrastructure providers
│   └── package.json
├── transcoder-service/    # Video processing service
│   ├── src/
│   │   ├── modules/
│   │   │   └── transcribe/ # Video transcription
│   │   └── providers/     # Infrastructure providers
│   └── package.json
└── README.md
```

## 🛠️ Setup and Installation

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL
- Redis
- Kafka
- AWS S3 account

### Environment Variables

Each service requires its own `.env` file with the following variables:

#### User Service (.env)
```env
PORT=8080
DATABASE_URL=postgresql://username:password@localhost:5432/youtube_clone
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
```

#### Upload Service (.env)
```env
PORT=8081
REDIS_URL=redis://localhost:6379
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=your-aws-region
AWS_S3_BUCKET=your-s3-bucket
KAFKA_BROKER=localhost:9092
```

#### Transcoder Service (.env)
```env
KAFKA_BROKER=localhost:9092
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=your-aws-region
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd youtube-clone/backend
   ```

2. **Install dependencies for each service**
   ```bash
   # User Service
   cd user-service
   npm install

   # Upload Service
   cd ../upload-service
   npm install

   # Transcoder Service
   cd ../transcoder-service
   npm install
   ```

3. **Set up infrastructure**
   ```bash
   # Start PostgreSQL
   # Start Redis
   # Start Kafka
   ```

4. **Run database migrations**
   ```bash
   # For User Service
   cd user-service
   npm run migration:run
   ```

## 🚀 Running the Services

### Development Mode

```bash
# Terminal 1 - User Service
cd user-service
npm run start:dev

# Terminal 2 - Upload Service
cd upload-service
npm run start:dev

# Terminal 3 - Transcoder Service
cd transcoder-service
npm run start:dev
```

### Production Mode

```bash
# Build and start each service
cd user-service && npm run build && npm run start:prod
cd upload-service && npm run build && npm run start:prod
cd transcoder-service && npm run build && npm run start:prod
```

## 📚 API Documentation

Each service provides Swagger documentation:

- **User Service**: http://localhost:8080/api/docs
- **Upload Service**: http://localhost:8081/api/docs

## 🔄 Service Communication

The services communicate through:

1. **HTTP APIs** for synchronous communication
2. **Kafka** for asynchronous event-driven communication
3. **Redis** for caching and session management

### Event Flow

1. User uploads video → Upload Service
2. Upload Service stores file in S3
3. Upload Service publishes `video.uploaded` event to Kafka
4. Transcoder Service consumes the event
5. Transcoder Service processes the video (transcription, etc.)

## 🧪 Testing

```bash
# Run tests for each service
cd user-service && npm test
cd upload-service && npm test
cd transcoder-service && npm test

# Run e2e tests
npm run test:e2e
```

## 📊 Health Monitoring

Each service provides health check endpoints:

- **User Service**: `GET /api/v1/health`
- **Upload Service**: `GET /api/v1/health`

Health checks monitor:
- Database connectivity
- Redis connectivity
- Memory usage
- Disk space
- Service dependencies

## 🔧 Development Scripts

### Common Commands

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugging

# Building
npm run build              # Build for production
npm run start:prod         # Start production build

# Code Quality
npm run lint               # Run ESLint
npm run format             # Format code with Prettier

# Database
npm run migration:generate # Generate new migration
npm run migration:run      # Run pending migrations
npm run migration:revert   # Revert last migration
```

## 🚧 Future Enhancements

- **Watch Service**: Video streaming and playback functionality
- **Comment Service**: User comments and interactions
- **Recommendation Service**: Video recommendations
- **Analytics Service**: Video performance metrics
- **Notification Service**: Real-time notifications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For questions or issues, please open an issue in the repository or contact the development team.
