# Upload Service

The Upload Service handles video file uploads, processing, and storage management for the YouTube clone application. It manages file uploads to AWS S3, validates file formats, and publishes events for downstream processing.

## 🎯 Purpose

This microservice manages:
- Video file uploads to cloud storage (AWS S3)
- File validation and processing
- Event publishing for video processing workflows
- Upload progress tracking
- File metadata management

## 🏗️ Architecture

- **Framework**: NestJS 10.x
- **Storage**: AWS S3 for file storage
- **Cache**: Redis for upload session management
- **Message Queue**: Kafka for event publishing
- **File Processing**: Multer for multipart uploads
- **Authentication**: JWT validation for protected uploads

## 📁 Project Structure

```
upload-service/
├── src/
│   ├── modules/
│   │   ├── upload/              # File upload handling
│   │   │   ├── upload.controller.ts
│   │   │   ├── upload.service.ts
│   │   │   ├── upload.module.ts
│   │   │   ├── dto/            # Upload DTOs
│   │   │   └── upload-kafka-producer.service.ts
│   │   └── health/             # Health monitoring
│   ├── providers/
│   │   └── infra/              # Infrastructure providers
│   │       ├── s3/             # AWS S3 integration
│   │       ├── kafka/         # Kafka producer
│   │       └── bullmq/        # Queue management
│   ├── common/
│   │   ├── auth/              # Authentication utilities
│   │   ├── decorators/        # Custom decorators
│   │   ├── filters/          # Exception filters
│   │   └── helpers/          # Utility functions
│   └── configs/              # Configuration files
├── test/                     # Test files
└── package.json
```

## 🚀 Features

### File Upload
- Multipart file upload support
- File size and type validation
- Chunked upload for large files
- Upload progress tracking
- Resume interrupted uploads

### Cloud Storage
- AWS S3 integration
- Automatic file organization
- CDN-ready file serving
- File versioning support
- Lifecycle management

### Event Publishing
- Kafka event publishing
- Upload completion notifications
- Processing workflow triggers
- Error event handling

### Security
- JWT authentication for uploads
- File type validation
- Virus scanning integration
- Access control and permissions

## 📚 API Endpoints

### Upload Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/upload/` | Upload single file | Yes |
| POST | `/api/v1/upload/multiple` | Upload multiple files | Yes |
| POST | `/api/v1/upload/chunk` | Chunked upload | Yes |
| GET | `/api/v1/upload/status/:uploadId` | Upload status | Yes |
| DELETE | `/api/v1/upload/:fileId` | Delete uploaded file | Yes |

### File Management Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/files` | List user files | Yes |
| GET | `/api/v1/files/:fileId` | Get file details | Yes |
| GET | `/api/v1/files/:fileId/download` | Download file | Yes |
| PUT | `/api/v1/files/:fileId` | Update file metadata | Yes |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Service health status |

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the upload-service directory:

```env
# Server Configuration
PORT=8081
NODE_ENV=development

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=youtube-clone-videos
AWS_S3_ENDPOINT=https://s3.amazonaws.com

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka Configuration
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=upload-service
KAFKA_GROUP_ID=upload-service-group

# File Upload Configuration
MAX_FILE_SIZE=500MB
ALLOWED_FILE_TYPES=mp4,avi,mov,wmv,flv,webm
UPLOAD_CHUNK_SIZE=5MB

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Swagger Configuration
SWAGGER_TITLE=Upload Service API
SWAGGER_DESCRIPTION=File upload and management API
SWAGGER_VERSION=1.0.0
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Redis
- Kafka
- AWS S3 account

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the service**
   ```bash
   # Development
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
   ```

## 📤 Upload Flow

### Single File Upload

```typescript
// Example upload request
const formData = new FormData();
formData.append('file', videoFile);
formData.append('title', 'My Video');
formData.append('description', 'Video description');

const response = await fetch('/api/v1/upload/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  },
  body: formData
});
```

### Chunked Upload

```typescript
// For large files, use chunked upload
const uploadChunk = async (chunk: Blob, chunkIndex: number, uploadId: string) => {
  const formData = new FormData();
  formData.append('chunk', chunk);
  formData.append('chunkIndex', chunkIndex.toString());
  formData.append('uploadId', uploadId);

  return fetch('/api/v1/upload/chunk', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwtToken}` },
    body: formData
  });
};
```

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Test Structure

```
test/
├── upload/
│   ├── upload.controller.spec.ts
│   ├── upload.service.spec.ts
│   └── upload-kafka-producer.spec.ts
├── providers/
│   ├── s3.service.spec.ts
│   └── kafka.service.spec.ts
└── app.e2e-spec.ts
```

## 📊 File Storage Schema

### File Metadata

```typescript
interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadDate: Date;
  userId: string;
  s3Key: string;
  s3Bucket: string;
  status: 'uploading' | 'completed' | 'failed';
  checksum: string;
  duration?: number; // for video files
  resolution?: string; // for video files
}
```

## 🔒 Security Features

### File Validation
- File type validation (whitelist approach)
- File size limits
- Virus scanning integration
- Malicious file detection

### Access Control
- JWT-based authentication
- User-specific file access
- Temporary signed URLs for downloads
- File ownership validation

### Data Protection
- Encryption at rest (S3)
- Secure file transfer
- Audit logging
- Data retention policies

## 📈 Monitoring and Health Checks

### Health Check Components

- **AWS S3 connectivity**
- **Redis connectivity**
- **Kafka connectivity**
- **Memory usage**
- **Disk space**
- **Upload queue status**

### Metrics

- Upload success/failure rates
- File processing times
- Storage usage
- Bandwidth utilization
- Error rates by type

## 🔄 Event Publishing

### Published Events

```typescript
// Video uploaded event
{
  eventType: 'video.uploaded',
  data: {
    videoId: string;
    userId: string;
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  }
}

// Upload failed event
{
  eventType: 'upload.failed',
  data: {
    uploadId: string;
    userId: string;
    error: string;
    failedAt: string;
  }
}
```

## 🛠️ Development

### Code Quality

```bash
# Linting
npm run lint

# Formatting
npm run format

# Type checking
npm run build
```

### Local Development

```bash
# Start with local environment
npm run start:local

# Debug mode
npm run start:debug
```

## 🚧 Future Enhancements

- **Video Processing**: Thumbnail generation, video transcoding
- **Progress Tracking**: Real-time upload progress
- **Resume Uploads**: Resume interrupted uploads
- **Batch Uploads**: Multiple file batch processing
- **CDN Integration**: CloudFront distribution
- **Analytics**: Upload statistics and insights

## 📝 API Documentation

Once the service is running, visit:
- **Swagger UI**: http://localhost:8081/api/docs
- **Health Check**: http://localhost:8081/api/v1/health

## 🔗 Integration Examples

### Frontend Integration

```javascript
// React component for file upload
const FileUpload = () => {
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v1/upload/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
      onUploadProgress: (progress) => {
        setUploadProgress(progress.loaded / progress.total * 100);
      }
    });

    return response.json();
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} />
      <progress value={uploadProgress} max="100" />
    </div>
  );
};
```

## 🤝 Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass
5. Follow the coding standards

## 📄 License

This service is part of the YouTube Clone project and follows the same licensing terms.