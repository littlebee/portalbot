# Portalbot - WebRTC Robot Platform

## Project Overview

Portalbot is a robotics platform built on the `basic_bot` framework that enables remote video communication and control via WebRTC. The system consists of a Python backend signaling server and a React-based web frontend, designed to be deployed on AWS EC2 with HTTPS support.

## Architecture

### Backend (Python)
- **Framework**: FastAPI with native WebSockets
- **Main Server**: `src/public_server.py` - WebRTC signaling server
  - Handles WebSocket connections for peer-to-peer signaling
  - Space-based video chat (max 2 participants per space)
  - Robot authentication and control workflow
  - Health check endpoint at `/health`
  - WebSocket endpoint at `/ws`
- **Robot Service**: `src/portalbot_service.py` - Robot-side telepresence service
  - Pygame UI (1080x1080 display) with animated robot eyes when idle
  - Displays remote operator's face when controlled
  - WebSocket client connecting to public_server
  - Face detection using OpenCV
  - Relays commands to basic_bot central_hub
  - Integrates with basic_bot services via HubStateMonitor
- **Runtime**: uvicorn (ASGI server)
- **Port**: 5080 (configurable via PORT env var)

### Basic Bot Services
The robot runs multiple services coordinated by basic_bot framework (defined in `basic_bot.yml`):
- `central_hub`: Main service coordinator and message bus
- `web_server`: Web interface for robot control
- `vision`: Computer vision processing service
- `system_stats`: System monitoring service
- `portalbot`: Robot telepresence service (defined in basic_bot.yml)

### Robot Authentication & Configuration
- **Robot Configuration**: `portalbot_robot.yml` - Per-robot config file
  - Contains robot_id, robot_name, space_id, secret_key_file path
  - Each robot has unique credentials
- **Space Configuration**: `portalbot_spaces.yml` - Defines available spaces
  - Lists allowed robot_ids per space via `robot_ids` array
  - Controls which robots can access which spaces
- **Robot Secrets**: `robot_secrets/` directory
  - Contains `<robot-id>.key` files (gitignored)
  - Managed by `src/commons/robot_secrets.py` (RobotSecrets class)
  - Loads secrets on server startup
  - Secret keys never stored in version control
- **Authentication Flow**:
  1. Robot connects to public_server with WebSocket
  2. Sends `robot_identify` message with robot_id, name, space, and secret_key
  3. Server validates: space exists, robot_id in space's allowed list, secret_key matches
  4. Robot registered and added to space

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
│   ├── public_server.py          # FastAPI WebRTC signaling server
│   ├── portalbot_service.py      # Robot-side telepresence service
│   └── commons/
│       ├── space_config.py       # Space configuration loader
│       ├── robot_config.py       # Robot configuration loader
│       └── robot_secrets.py      # Robot secrets management
├── robot_secrets/                 # Robot secret keys (gitignored)
│   ├── README.md                 # Instructions for managing secrets
│   └── <robot-id>.key            # Secret key files (gitignored)
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
│   └── test_space_config.py
├── basic_bot.yml                  # Basic bot service configuration
├── portalbot_spaces.yml           # Space definitions and robot access
├── portalbot_robot.yml            # Robot instance configuration
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
├── robot_secrets/*.key            # Robot secret key files
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

### Robot Control Workflow
The robot control flow follows this sequence:
1. **Robot Joins**: Robot authenticates and joins its designated space
2. **Human Joins**: Human joins same space, sees available robots
3. **Control Request**: Human clicks "Teleport" button, sends `control_request` message
4. **Validation**: Robot validates audio presence and face detection
5. **Control Grant**: Robot sends `control_granted` message if validation passes
6. **Active Control**: Human can send `remote_command` messages to robot
7. **Release**: Either party can send `control_release` to end control session

**WebSocket Message Types**:
- Robot → Server: `robot_identify`, `control_granted`, `control_release`
- Human → Server: `join_space`, `control_request`, `control_release`, `remote_command`
- Server → Robot: `connected`, `joined_space`, `control_request`, `control_released`, `remote_command`
- Server → Human: `connected`, `joined_space`, `robot_joined`, `control_granted`, `control_released`

### Robot Secret Key Management
- Generate new robot keys: `python -c "import secrets; print(secrets.token_urlsafe(32))" > robot_secrets/<robot-id>.key`
- Add robot_id to space's `robot_ids` array in `portalbot_spaces.yml`
- Configure robot with matching robot_id in `portalbot_robot.yml`
- Never commit `.key` files to version control

### WebRTC Requirements
- HTTPS is required for camera/microphone access in browsers
- TURN server needed for NAT traversal in restrictive networks
- SSL certificates must be valid (Let's Encrypt in production)
- WebRTC implementation is pending (aiortc integration planned)

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

### Running the Robot Service
The robot service runs as part of basic_bot services:
```bash
# Start all services including portalbot
bb_start

# Or run portalbot service directly for testing
python src/portalbot_service.py

# View robot logs
tail -f logs/portalbot.log
```

### Adding a New Robot
1. Generate a secret key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))" > robot_secrets/robot-2.key
   ```
2. Add robot to space in `portalbot_spaces.yml`:
   ```yaml
   spaces:
     - id: "robot-space"
       robot_ids: ["robot-1", "robot-2"]  # Add robot-2
   ```
3. Create robot config file (or update `portalbot_robot.yml`):
   ```yaml
   robot_id: "robot-2"
   robot_name: "Robot 2"
   space_id: "robot-space"
   secret_key_file: "./robot_secrets/robot-2.key"
   ```

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
- **Current Branch**: bee/portalbot_service
- **Main Branch**: Not configured (use default branch for PRs)
- **Recent Work**:
  - Implemented portalbot_service.py (robot-side telepresence service)
  - Created secure file-based robot authentication system
  - Added robot configuration management (robot_config.py, robot_secrets.py)
  - Implemented control workflow (request/grant/release)
  - Enhanced public_server.py with robot/human differentiation
  - All code passes flake8 and mypy linting

## Development Notes
- Use Black formatter for all Python code
- Robot service integrates with basic_bot via HubStateMonitor
- Face detection requires OpenCV with Haar Cascade classifier
- WebRTC video/audio relay is planned but not yet implemented (aiortc)
- Control validation (audio + face detection) is stubbed out for now
