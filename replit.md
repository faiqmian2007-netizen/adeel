# Overview

This is a Facebook automation server management platform that allows users to create, monitor, and control multiple Facebook bot servers. The application provides a professional dashboard for managing automated messaging services with real-time monitoring capabilities through WebSocket connections.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend uses vanilla JavaScript with a multi-page application (MPA) structure. Static HTML files are served directly by Express, with dedicated pages for authentication (login/register), dashboard management, and server creation. The UI implements a modern, responsive design with Socket.IO for real-time updates and JWT-based authentication stored in localStorage.

## Backend Architecture
Built on Node.js with Express as the web framework. The server implements a RESTful API structure with dedicated route handlers for authentication and server management. Real-time communication is handled through Socket.IO for live server status updates and log streaming. The application uses in-memory storage with class-based models for User and Server entities, designed to be easily migrated to a database later.

## Authentication & Authorization
JWT-based authentication system with bcrypt for password hashing. Tokens are generated with 24-hour expiration and stored in localStorage on the client. Middleware validates tokens on protected routes and Socket.IO connections. User sessions are maintained through HTTP headers with Bearer token authentication.

## Security Implementation
Multiple security layers including Helmet for HTTP headers protection, CORS configuration for cross-origin requests, and express-rate-limit for API throttling (100 requests per 15 minutes). Content Security Policy (CSP) directives are configured to allow necessary resources while blocking potential XSS attacks. File upload restrictions limit uploads to text files under 5MB.

## Real-time Communication
Socket.IO handles bidirectional communication for server status updates, live console logs, and user notifications. Each user's socket connection is authenticated and isolated to prevent cross-user data leakage. Server events are broadcasted to specific users based on ownership.

## File Management
Multer middleware handles file uploads for message files, with organized storage in an uploads directory. Files are validated for type (.txt only) and size constraints. Unique filenames prevent conflicts and organize user uploads.

# Recent Changes

- **September 14, 2025**: Cookie Checking System Integration and Enhancement
  - **Fixed Critical Cookie Validation Error**: Resolved "req.body undefined" error by adding JSON parsing middleware for cookie routes
  - **Integrated Reliable Cookie Testing**: Successfully merged working cookie validation logic from standalone cookie.js into main web app
  - **Enhanced Cookie Validation Approach**: Replaced parameter analysis with actual Facebook login testing using ws3-fca library
  - **New Reliable Endpoints**: Added `/api/cookies/test-reliable` and `/api/cookies/test-bulk-reliable` endpoints with real Facebook authentication testing
  - **Frontend Integration**: Updated cookie checking interface to use new reliable endpoints with better error handling
  - **Improved Security**: Added automatic cleanup of temporary appstate files to prevent sensitive data persistence
  - **Better User Experience**: Cookie validation now provides actual user profile information (name, profile URL, profile picture) instead of just validity status

- **September 13, 2025**: Major improvements to Create Post Server and Console functionality
  - Fixed critical "Create & Run Post Server" button functionality issue
  - Resolved non-responsive button by implementing direct inline JavaScript with proper form validation
  - **Embedded Console System**: Replaced popup window console with embedded dashboard console
  - Console now opens within dashboard instead of new window for better user experience
  - Added live console controls (Clear/Close buttons) with connection status indicators
  - Implemented color-coded log entries (error, warning, success, info) with auto-scroll
  - Maintained all existing functionality: single/multi-cookie support, file upload, and paste content modes
  - Enhanced UI with modern gradient designs and improved console styling

- **September 5, 2025**: Complete application built from scratch with professional UI/UX
- Created full authentication system with login/register functionality
- Built responsive dashboard with user profile display and server management
- Implemented server creation page with Facebook cookie, Group TID, file upload, and speed controls
- Added real-time server monitoring with Socket.IO for live status updates
- Created live console view for server log monitoring in popup windows
- Implemented complete CRUD operations for server management (start, stop, restart, delete)
- Added professional CSS styling with modern gradient designs and responsive layouts
- Built scalable architecture to handle thousands of concurrent users

# Project Architecture

## Directory Structure
```
/
├── index.js                 # Main Express server
├── models/                  # Data models
│   ├── User.js             # User model with authentication
│   └── Server.js           # Server model with status management
├── middleware/             # Express middleware
│   └── auth.js             # JWT authentication middleware
├── routes/                 # API route handlers
│   ├── auth.js            # Authentication routes (login/register)
│   └── servers.js         # Server management routes
├── public/                # Frontend static files
│   ├── index.html         # Landing page
│   ├── login.html         # Login page
│   ├── register.html      # Registration page
│   ├── dashboard.html     # Main dashboard
│   ├── create-server.html # Server creation form
│   ├── css/              # Stylesheets
│   │   ├── style.css     # Landing page styles
│   │   ├── auth.css      # Authentication page styles
│   │   ├── dashboard.css # Dashboard styles
│   │   └── create-server.css # Server creation styles
│   └── js/               # Client-side JavaScript
│       ├── app.js        # Landing page functionality
│       ├── auth.js       # Authentication handling
│       ├── dashboard.js  # Dashboard management
│       └── create-server.js # Server creation functionality
└── uploads/              # File upload storage
```

## Key Features Implemented
1. **User Management**: Secure registration and login with email validation and strong password requirements
2. **Profile Dashboard**: Professional user interface displaying profile details and server statistics
3. **Server Creation**: Modern form with Facebook cookie input, Group TID, file upload, and speed configuration
4. **Server Management**: Complete lifecycle management with start/stop/restart/delete operations
5. **Real-time Monitoring**: Live server status updates and console log viewing
6. **File Upload**: Secure .txt file upload with size and type validation
7. **Responsive Design**: Mobile-friendly interface with modern gradients and animations
8. **WebSocket Integration**: Real-time bidirectional communication for instant updates

# External Dependencies

## Core Framework Dependencies
- **Express 5.1.0**: Web application framework for routing and middleware
- **Socket.IO 4.8.1**: Real-time bidirectional communication between client and server
- **Node.js**: Runtime environment for server-side JavaScript execution

## Security Dependencies
- **bcrypt 6.0.0**: Password hashing and verification for user authentication
- **jsonwebtoken 9.0.2**: JWT token generation and validation for stateless authentication
- **helmet 8.1.0**: Security middleware for setting HTTP headers
- **express-rate-limit 8.1.0**: API rate limiting to prevent abuse
- **cors 2.8.5**: Cross-Origin Resource Sharing configuration

## File & Utility Dependencies
- **multer 2.0.2**: Multipart form data handling for file uploads
- **uuid 11.1.0**: Unique identifier generation for users and servers

## Facebook Integration
- **ws3-fca 2.0.1**: Facebook Chat API wrapper for automated messaging functionality (handles Facebook authentication and message sending)

## Development Dependencies
- **@types/node 22.13.11**: TypeScript definitions for Node.js development support

The application is designed to integrate with Facebook's messaging platform through cookie-based authentication, allowing users to automate message sending to Facebook groups. The system supports multiple concurrent server instances per user with independent configuration and monitoring.