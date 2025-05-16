# Task Management System

A mini backend system for task management with user authentication built with Express.js, TypeScript, and MongoDB.

## Features

- User registration and authentication with JWT
- Task creation, assignment, listing, status updates, and deletion
- Automated task closure for tasks in progress for more than 2 hours
- API documentation with Swagger
- Unit testing with Jest

## Tech Stack

- Express.js
- TypeScript
- MongoDB (with Mongoose)
- JWT for authentication
- node-cron for scheduled tasks
- Swagger/OpenAPI for API documentation
- Jest and Supertest for testing

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or remote)

### Installation

1. Clone the repository:

```
git clone <repository-url>
cd task-management-system
```

2. Install dependencies:

```
npm install
```

3. Create a `.env` file in the root directory with the following content:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/task-management
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
```

4. Build the application:

```
npm run build
```

5. Start the server:

```
npm start
```

For development with auto-reload:

```
npm run dev
```

### Running Tests

```
npm test
```

## API Documentation

Once the server is running, you can access the Swagger documentation at:

```
http://localhost:3000/api-docs
```

## API Endpoints

### Users

- `POST /users` - Register a new user
- `POST /users/login` - Authenticate user and get token
- `GET /users/profile` - Get user profile (authenticated)

### Tasks

- `POST /tasks` - Create a new task
- `GET /tasks?userId=` - Get all tasks for a user
- `PATCH /tasks/:id/status` - Update task status (pending, in-progress, done)
- `DELETE /tasks/:id` - Delete a task

## Features

### Edge Case Handling

- Prevents duplicate tasks with the same title for the same user
- Validates user existence before assigning a task
- When a task is marked as done, a completedAt timestamp is stored
- Includes a scheduled job that auto-closes tasks that are in-progress for more than 2 hours

## License

MIT
