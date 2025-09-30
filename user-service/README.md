# User Service

The User Service is responsible for user authentication, registration, and user management in the YouTube clone application. It handles all user-related operations including login, registration, profile management, and JWT token generation.

## 🎯 Purpose

This microservice manages:
- User registration and authentication
- JWT token generation and validation
- User profile management
- Password hashing and security
- Session management with Redis

## 🏗️ Architecture

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis for session management
- **Authentication**: JWT with Passport
- **Validation**: Class-validator for input validation
- **Documentation**: Swagger/OpenAPI

## 📁 Project Structure

```
user-service/
├── src/
│   ├── modules/
│   │   ├── auth/              # Authentication module
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── dto/           # Data Transfer Objects
│   │   │   ├── guards/       # JWT guards
│   │   │   └── strategies/   # Passport strategies
│   │   ├── user/             # User management
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.module.ts
│   │   │   ├── entities/     # User entity
│   │   │   └── dto/          # User DTOs
│   │   └── health/           # Health monitoring
│   ├── database/
│   │   ├── postgres/         # PostgreSQL configuration
│   │   └── redis/           # Redis configuration
│   ├── common/              # Shared utilities
│   │   ├── decorators/      # Custom decorators
│   │   ├── filters/         # Exception filters
│   │   ├── guards/          # Global guards
│   │   ├── interceptors/    # Response interceptors
│   │   └── helpers/         # Utility functions
│   └── configs/             # Configuration files
├── test/                    # Test files
└── package.json
```

## 🚀 Features

### Authentication
- User registration with email validation
- Secure login with bcrypt password hashing
- JWT token generation and validation
- Password reset functionality
- Session management

### User Management
- User profile CRUD operations
- User data validation
- User search and filtering
- Profile image management

### Security
- Password hashing with bcrypt
- JWT token expiration
- Input validation and sanitization
- CORS configuration
- Helmet for security headers

## 📚 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | User registration | No |
| POST | `/api/v1/auth/login` | User login | No |
| POST | `/api/v1/auth/logout` | User logout | Yes |
| POST | `/api/v1/auth/refresh` | Refresh JWT token | Yes |
| POST | `/api/v1/auth/forgot-password` | Request password reset | No |
| POST | `/api/v1/auth/reset-password` | Reset password | No |

### User Management Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/users/profile` | Get user profile | Yes |
| PUT | `/api/v1/users/profile` | Update user profile | Yes |
| DELETE | `/api/v1/users/profile` | Delete user account | Yes |
| GET | `/api/v1/users/:id` | Get user by ID | Yes |
| GET | `/api/v1/users` | Search users | Yes |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Service health status |

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the user-service directory:

```env
# Server Configuration
PORT=8080
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/youtube_clone
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=youtube_clone

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Swagger Configuration
SWAGGER_TITLE=User Service API
SWAGGER_DESCRIPTION=User management and authentication API
SWAGGER_VERSION=1.0.0
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL
- Redis

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

3. **Run database migrations**
   ```bash
   npm run migration:run
   ```

4. **Start the service**
   ```bash
   # Development
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
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
├── auth/
│   ├── auth.controller.spec.ts
│   └── auth.service.spec.ts
├── user/
│   ├── user.controller.spec.ts
│   └── user.service.spec.ts
└── app.e2e-spec.ts
```

## 📊 Database Schema

### User Entity

```typescript
@Entity('users')
export class User extends AbstractEntity<User> {
  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ nullable: true })
  profile_image_url: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_verified: boolean;
}
```

## 🔒 Security Features

### Password Security
- Bcrypt hashing with salt rounds
- Password strength validation
- Secure password reset flow

### JWT Security
- Short-lived access tokens (24h)
- Long-lived refresh tokens (7d)
- Token blacklisting on logout
- Secure token storage recommendations

### Input Validation
- Email format validation
- Password strength requirements
- SQL injection prevention
- XSS protection

## 📈 Monitoring and Health Checks

### Health Check Endpoints

The service provides comprehensive health monitoring:

- **Database connectivity**
- **Redis connectivity**
- **Memory usage**
- **Disk space**
- **Service uptime**

### Metrics

- Request/response times
- Error rates
- Authentication success/failure rates
- User registration/login statistics

## 🔄 Integration with Other Services

### Communication Patterns

1. **Synchronous**: HTTP API calls to other services
2. **Asynchronous**: Event publishing for user-related events
3. **Caching**: Redis for session and user data caching

### Events Published

- `user.registered` - When a new user registers
- `user.updated` - When user profile is updated
- `user.deleted` - When user account is deleted

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

### Database Operations

```bash
# Generate migration
npm run migration:generate -- -n CreateUserTable

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## 🚧 Future Enhancements

- **OAuth Integration**: Google, Facebook, GitHub login
- **Two-Factor Authentication**: SMS/Email 2FA
- **User Roles**: Admin, moderator, regular user roles
- **Social Features**: User following, friend requests
- **Analytics**: User behavior tracking
- **Notifications**: Email/SMS notifications

## 📝 API Documentation

Once the service is running, visit:
- **Swagger UI**: http://localhost:8080/api/docs
- **Health Check**: http://localhost:8080/api/v1/health

## 🤝 Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass
5. Follow the coding standards

## 📄 License

This service is part of the YouTube Clone project and follows the same licensing terms.