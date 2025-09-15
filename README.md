# Server Manager – Professional Multi-Server Platform

A production-ready Node.js/Express application for managing multiple servers with authentication, real-time monitoring via Socket.IO, and a clean dashboard UI.

## Features

- Secure auth with JWT and rate limiting
- Real-time log/room updates over Socket.IO
- Static UI served from `public` with modern styling
- Admin and dashboard routes

## Project Structure

```
index.js                 # Express + Socket.IO server
public/                  # Static assets (HTML, CSS, JS)
  css/                   # Stylesheets
  js/                    # Browser scripts
routes/                  # API route modules
models/                  # Data models (e.g., User, Server)
middleware/              # Auth and security helpers
```

## Local Development

Prerequisites: Node.js 18+.

```bash
npm install
npm start
```

The app will listen on `http://localhost:3000` (or `$PORT`).

## Deployment (AWS EC2 / Lightsail / any Linux VM)

1. SSH into your instance and install Node.js 18+ and npm.
2. Copy repository files to a directory, e.g. `/var/www/server-manager`.
3. Install dependencies and start the server bound to all interfaces:

```bash
cd /var/www/server-manager
npm ci || npm install
PORT=3000 node index.js
```

4. Optional but recommended: run with a process manager and reverse proxy

### PM2

```bash
npm i -g pm2
PORT=3000 pm2 start index.js --name server-manager
pm2 save
pm2 startup
```

### Nginx reverse proxy (HTTPS via Certbot)

1. Install Nginx and Certbot.
2. Create a site config that proxies to Node on port 3000 and serves WebSocket upgrades.

Sample Nginx location block:

```
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

## Environment

Set the following environment variables as needed:

- `PORT` – Listening port (default `3000`)
- `JWT_SECRET` – Token secret for auth flows

## Troubleshooting static files on cloud hosts

- Ensure the process listens on `0.0.0.0` (already configured in `index.js`).
- Security headers are configured via `helmet` to allow inline styles/scripts used by this UI, WebSockets, and cross-origin asset loads when needed.
- Static assets are mounted from `public/` as well as explicit `/css` and `/js` mounts.

If you still cannot see styles or scripts:

- Clear browser cache or add `?v=1` to asset URLs
- Check server logs for 404s to `/css/...` or `/js/...`
- Verify file permissions on the server and that `public/` exists alongside `index.js`

## License

ISC