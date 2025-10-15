# Portalbot - WebRTC Robot Platform

## Project Overview

Portalbot is a robotics platform built on the `basic_bot` framework that enables remote video communication and control via WebRTC. The system consists of a Python backend signaling server and a React-based web frontend, designed to be deployed on AWS EC2 with HTTPS support.

## Architecture

### Backend (Python)
- **Framework**: FastAPI with native WebSockets
- **Main Server**: `src/public_server.py` - WebRTC signaling server
  - Handles WebSocket connections for peer-to-peer signaling
  - Space-based video chat (max 2 participants per space)
  - Health check endpoint at `/health`
  - WebSocket endpoint at `/ws`
- **Runtime**: uvicorn (ASGI server)
- **Port**: 5080 (configurable via PORT env var)

### Basic Bot Services
The robot runs multiple services coordinated by basic_bot framework (defined in `basic_bot.yml`):
- `central_hub`: Main service coordinator and message bus
- `web_server`: Web interface for robot control
- `vision`: Computer vision processing service
- `system_stats`: System monitoring service

### Frontend (React)
Location: `webapp/`
- **Framework**: React 19 with TypeScript
- **Routing**: TanStack Router (code-based routing)
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite
- **Testing**: Vitest with React Testing Library
- **Dev Tools**: ESLint, Prettier

The webapp is currently a fresh TanStack template that will be used for the robot control interface.

## Deployment

### Production Environment
- **Platform**: AWS EC2 (Ubuntu)
- **Domain**: portalbot.net (DNS via IONOS)
- **IP**: 3.134.87.34
- **Web Server**: nginx (reverse proxy)
- **SSL/TLS**: Let's Encrypt certificates (auto-renewal enabled)
- **Process Manager**: systemd (`portalbot.service` or `portalbot_public.service`)

### Required Ports
- 80, 443: HTTP/HTTPS
- 22: SSH
- 5080: FastAPI backend (internal)
- 3478-3479, 5349: STUN/TURN server
- 32355-65535: TURN ephemeral ports (UDP/TCP)

### Deployment Scripts
- `./upload.sh <host> [target_dir]`: Upload code to remote server via rsync
- `./start_public.sh`: Start the public signaling server
- `./restart.sh`: Restart all services
- `./start.sh`, `./stop.sh`: Start/stop basic_bot services

See `DEPLOYMENT.md` for complete deployment instructions.

## Development Setup

### Python Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Run linter and type checker
./lint.sh

# Run tests
./test.sh

# Start public server (local)
python src/public_server.py
```

### React Frontend
```bash
cd webapp
npm install
npm run dev          # Start dev server on port 3000
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Lint code
npm run format       # Format code
```

## Code Quality & Testing

### Python
- **Linter**: flake8 (configured in `.flake8`)
- **Type Checker**: mypy (configured in `mypy.ini`)
- **Testing**: pytest
- **Python Version**: 3.9+
- Test files: `tests/test_*.py`
- Test helper: basic_bot.test_helpers

### TypeScript/React
- **Linter**: ESLint (@tanstack/eslint-config)
- **Formatter**: Prettier
- **Testing**: Vitest with jsdom
- Test files: `*.test.tsx`

### CI/CD
GitHub Actions workflow (`.github/workflows/ci.yml`):
- Runs on: push to main, pull requests to main
- Python 3.9 matrix
- Steps: lint, type check, run tests
- Uploads logs as artifacts

## Project Structure

```
.
├── src/
│   └── public_server.py          # FastAPI WebRTC signaling server
├── webapp/                        # React frontend
│   ├── src/
│   │   ├── App.tsx               # Main app component
│   │   ├── main.tsx              # App entry point with router
│   │   └── components/
│   │       └── Header.tsx
│   ├── package.json
│   └── vite.config.ts
├── tests/                         # Python tests
│   ├── conftest.py
│   └── test_tunnel_service.py
├── basic_bot.yml                  # Service configuration
├── requirements.txt               # Python dependencies
├── DEPLOYMENT.md                  # AWS deployment guide
├── nginx.conf                     # Nginx configuration
├── portalbot_public.service       # Systemd service file
├── upload.sh                      # Deployment script
├── lint.sh                        # Python linting
└── test.sh                        # Run all tests

Excluded from git:
├── logs/                          # Application logs
├── pids/                          # Process ID files
├── node_modules/                  # NPM dependencies
└── .env                           # Environment variables
```

## Key Technologies

### Python Stack
- fastapi==0.109.0 - Web framework
- uvicorn==0.27.0 - ASGI server
- websockets==10.4 - WebSocket support
- aiortc - WebRTC implementation
- aiohttp, aiohttp-cors - Async HTTP
- opencv-python - Computer vision
- pygame, pyttsx3 - Multimedia/TTS
- basic_bot - Robot framework (from GitHub)

### JavaScript/TypeScript Stack
- react 19.0.0 - UI framework
- @tanstack/react-router 1.132.0 - Routing
- tailwindcss 4.0.6 - CSS framework
- vite 7.1.7 - Build tool
- typescript 5.7.2 - Type safety
- basic_bot_react (from GitHub) - Robot UI components

## Important Notes

### WebRTC Requirements
- HTTPS is required for camera/microphone access in browsers
- TURN server needed for NAT traversal in restrictive networks
- SSL certificates must be valid (Let's Encrypt in production)

### Service Management
Use `bb_start` and `bb_stop` commands (from basic_bot) to manage robot services:
```bash
bb_start   # Start all services defined in basic_bot.yml
bb_stop    # Stop all services
```

### Environment Variables
The public server uses these environment variables (optional):
- `PORT`: Server port (default: 5080)
- `DEBUG`: Enable debug mode (default: False)
- `SECRET_KEY`: Flask secret key (generate with `secrets.token_hex(32)`)

## Common Tasks

### Adding a New Route (Frontend)
Edit `webapp/src/main.tsx` and create a new route:
```tsx
const newRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/new-path",
  component: YourComponent,
});
```

### Debugging WebSocket Issues
Check the connection flow:
1. Client connects → receives `connected` message with `sid`
2. Client sends `join_space` → receives `joined_space` with participant list
3. Peer exchange: `offer` ↔ `answer` messages
4. ICE candidates: `ice_candidate` messages for NAT traversal

### Monitoring Production
```bash
# View logs
sudo journalctl -u portalbot -f

# Check service status
sudo systemctl status portalbot

# Restart service
sudo systemctl restart portalbot

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Repository Information
- **Current Branch**: bee/publicServer
- **Main Branch**: Not configured (use default branch for PRs)
- **Git Status**: Clean (at time of CLAUDE.md generation)
- **Recent Commits**:
  - 8e5e245: Remove webapp/ and create anew
  - ee17c3a: add placeholder test for future service
  - 363d7d6: add aws deployment instructions + updated conf files from walky valky
