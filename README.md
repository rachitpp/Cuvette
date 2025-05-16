# 📋 Task Management System

<div align="center">
  
  ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
  ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
  ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
  ![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
  ![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)
  ![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)

  <p>A robust, secure task management API built with TypeScript, Express.js, and MongoDB</p>
  
  <p>🌐 <b>Live API:</b> <a href="https://cuvette-2ft9.onrender.com/" target="_blank">https://cuvette-2ft9.onrender.com/</a></p>
  <p>📚 <b>API Documentation:</b> <a href="https://cuvette-2ft9.onrender.com/api-docs" target="_blank">https://cuvette-2ft9.onrender.com/api-docs</a></p>
</div>

## ✨ Features

### 👤 User Management

- **Secure Authentication** - JWT-based authentication system
- **Comprehensive Validation** - Strict validation for user registration and authentication
- **Password Security** - BCrypt hashing with salt for secure password storage
- **Profile Management** - User profile retrieval and update functionality

### 📝 Task Management

- **CRUD Operations** - Complete Create, Read, Update, Delete functionality
- **Filtering & Sorting** - Filter tasks by status, priority, category, and due date
- **Collaboration** - Assign tasks to multiple collaborators
- **Categories & Tags** - Organize tasks with categories and tags
- **Priority Levels** - Assign Low, Medium, High, or Urgent priority
- **Status Tracking** - Track tasks as Pending, In-Progress, or Done
- **Timestamps** - Automatic tracking of created, started, and completed times

### ⚙️ Advanced Features

- **Automated Task Management** - Cron job system to auto-close tasks in-progress for over 2 hours
- **Transaction Support** - MongoDB transactions for data integrity
- **Retry Mechanisms** - Smart retries for database operations with configurable parameters
- **Graceful Shutdown** - Proper connection closing and resource cleanup

### 🔐 Security Features

- **Input Validation** - Comprehensive validation of all user inputs
- **JWT Security** - Secure token generation with environment-based secrets
- **Password Policies** - Enforced password complexity requirements
- **Error Sanitization** - Production-safe error messages to prevent information leakage

### 🧪 Testing

- **Unit Tests** - Comprehensive test coverage for controllers and models
- **Mocked Dependencies** - Isolated testing with proper mocking
- **Validation Testing** - Tests for all validation rules and edge cases

### 📚 Documentation

- **Swagger/OpenAPI** - Full API documentation with Swagger UI
- **Health Checks** - Detailed health check endpoint with database status

## 🛠️ Tech Stack

- **Backend**: Express.js, TypeScript, Node.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express Validator
- **Scheduling**: Node-cron
- **Testing**: Jest, Supertest
- **Documentation**: Swagger/OpenAPI
- **Error Handling**: Custom middleware and utils

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd task-management
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
# Create a .env file in the root directory with:
PORT=3000
MONGODB_URI=mongodb://localhost:27017/task-management
JWT_SECRET=your_secure_secret_here
NODE_ENV=development
```

4. Start the development server:

```bash
npm run dev
```

5. Build for production:

```bash
npm run build
npm start
```

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch
```

## 📡 API Endpoints

### Authentication

- `POST /users` - Register a new user
- `POST /users/login` - Login and get JWT token
- `GET /users/profile` - Get current user profile (protected)

### Tasks

- `GET /tasks` - List all tasks (with filters)
- `GET /tasks/:id` - Get a specific task
- `POST /tasks` - Create a new task
- `PATCH /tasks/:id` - Update a task
- `DELETE /tasks/:id` - Delete a task
- `PATCH /tasks/:id/status` - Update task status

## 📊 Database Schema

### User Model

- Username (unique)
- Email (unique)
- Password (hashed)
- Created/Updated timestamps

### Task Model

- Title
- Description
- Status (pending, in-progress, done)
- Priority (low, medium, high, urgent)
- Owner (User reference)
- Collaborators (User references)
- Tags
- Category
- Due Date (accepts DD-MM-YYYY format, e.g., "15-12-2023")
- Started/Completed timestamps
- Comments

## 🛡️ Error Handling and Security

- Custom error handling middleware for consistent responses
- Database transaction support for data integrity
- Rate limiting to prevent abuse
- Secure JWT implementation with proper error messages
- Validation for all user inputs
- Production-safe error messages

## 📚 Documentation

Once the server is running, access the Swagger documentation at:

```
http://localhost:3000/api-docs
```

For the deployed version, access the documentation at:

```
https://cuvette-2ft9.onrender.com/api-docs
```

## 🔄 Continuous Integration

The project includes configuration for continuous integration:

- Test runs on each push
- Linting checks
- Type checking
- Test coverage reports

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">
  <p>Built with ❤️ by Rachit Panwar</p>
</div>
