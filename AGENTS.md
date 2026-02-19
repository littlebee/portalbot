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
- `vision`: Computer vision processing service
- `system_stats`: System monitoring service
- `portalbot`: Robot telepresence service (defined in basic_bot.yml)


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


### Deployment Scripts
- `./upload.sh <host> [target_dir]`: Upload code to remote server via rsync
- `./start_public.sh`: Start the public signaling server
- `./stop_public.sh`: Stop the public signaling server
- `./restart_public.sh`: Restart the public signaling server
- `./start_robot.sh`: Start the services that run locally on the robot
- `./start_robot.sh`: Stop the services that run locally on the robot
- `./start_robot.sh`: restart the services that run locally on the robot

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

### upload files

After building the webapp and linting the python, upload the files to EC2 and to a test robot. This requires that your public ssh keys are installed on the robot and EC2 instance.

```bash
./upload.sh ec2-3-134-87-34.us-east-2.compute.amazonaws.com
./upload.sh pi5.local

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
│   ├── onboard_ui_service.py     # Handles robots onboard display
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

TBD

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
Can Use `bb_start` and `bb_stop` commands (from basic_bot) directly to manage robot services, but note that the `start_robot.sh` and `stop_robot.sh` also pass through all args to `bb_start` and `bb_stop`
```bash
bb_start   # Start all services defined in basic_bot.yml
bb_stop    # Stop all services
```

If a robot service get's hung up and refuses to shutdown normally (as can happen if you fail to stop a python thread), `bb_killall` command can be used to stop any and all processes created by bb_start regarless of where they were started.


## Development Notes
- Use Black formatter for all Python code
- Robot service integrates with basic_bot via HubStateMonitor
- Face detection requires OpenCV with Haar Cascade classifier
- WebRTC video/audio relay is planned but not yet implemented (aiortc)
- Control validation (audio + face detection) is stubbed out for now
