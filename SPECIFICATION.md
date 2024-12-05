# Multi-Game Platform Specification

## Platform Overview
This platform currently hosts two separate interactive web-based games:
1. Spinwheel - An interactive wheel spinning application
2. Maze Game - A multiplayer maze navigation game

Both games are built on the same technical foundation using Node.js and Socket.IO for real-time interactions.

## Architecture

### Backend Components
1. **Server (server.js)**
   - Built with Express.js
   - Uses Socket.IO for real-time updates
   - Implements HTTP server for static file serving
   - Handles game management and persistence

2. **Game Management System**
   - Manages game states and configurations
   - Persists game data in JSON format
   - Handles game creation and retrieval
   - Implements real-time updates via Socket.IO

### Frontend Components
1. **Creator Interface (creator.html)**
   - Allows users to create custom wheels
   - Provides text input for wheel segments
   - Generates shareable links for created wheels
   - Implements input validation

2. **Viewer Interface (viewer.html)**
   - Displays the interactive spinning wheel
   - Handles wheel animation and interaction
   - Shows results and maintains session state
   - Provides real-time updates for all viewers

3. **Maze Game Creator Interface (maze-creator.html)**
   - Allows configuration of game parameters:
     - X: Number of cookies needed to win
     - T: Trap cooldown time in seconds
     - K: Number of cookies in the maze
     - Maze size (optional)
   - Generates unique game URLs for sharing

4. **Maze Game Player Interface (maze-player.html)**
   - Real-time game view using Canvas
   - Socket.IO based player synchronization
   - Live game status updates
   - Support for two players
   - Visual representation of maze, players, cookies, and traps

5. **Maze Game Viewer Interface (maze-viewer.html)**
   - Spectator mode for watching ongoing games
   - Real-time game state visualization
   - Display of game statistics and status

### Technology Stack
- **Backend:**
  - Node.js
  - Express.js (^4.21.1)
  - Socket.IO (^4.8.1)
  - Express Rate Limit (^7.4.1)
  - UUID (^11.0.3)
  - Sanitize HTML (^2.13.1)

- **Frontend:**
  - HTML5
  - CSS3
  - JavaScript (Vanilla)
  - Socket.IO Client

## Games

### 1. Spinwheel Application
#### Overview
The Spinwheel application is a web-based interactive wheel spinning platform that allows users to create and share customizable spinning wheels. It's built using Node.js and Express on the backend with Socket.IO for real-time communication, providing an engaging and interactive user experience.

#### Features
- Users can create custom wheels with multiple segments
- Each segment can be individually named
- Input validation ensures proper wheel configuration
- Generates unique URLs for sharing

#### Wheel Interaction
- Real-time spinning animation
- Synchronized view for all participants
- Random result selection
- Persistent wheel state
- Share functionality

### 2. Maze Game

#### Overview
The Maze Game is a multiplayer maze navigation game where players compete to collect cookies while avoiding traps. The game features customizable parameters and real-time multiplayer interaction.

#### Game Mechanics
- Multiplayer support (2 players)
- Cookie collection system
- Trap placement and cooldown mechanics
- Win condition based on cookie collection
- Real-time player position updates
- Game state synchronization

#### Technical Implementation
- Canvas-based rendering
- Socket.IO for real-time updates
- Game state management
- Player session handling
- Collision detection
- Score tracking

#### Data Management
- Game configurations stored in games.json
- Real-time state synchronization
- Player session persistence
- Game result tracking

## Data Structures

### 1. Maze Game Data Structure (games.json)
The maze game data is stored in a JSON format where each game is identified by a UUID key. Each game object contains:

```json
{
    "[gameId]": {
        "gameId": "UUID string",
        "X": "number of cookies to win",
        "T": "trap cooldown in seconds",
        "K": "number of cookies in maze",
        "mazeSize": "size of the maze",
        "players": [
            "socket_id_1",
            "socket_id_2"
        ],
        "cookies": [
            {"x": number, "y": number}
        ],
        "traps": [],
        "gameStarted": boolean,
        "gameEnded": boolean,
        "winner": "winner_socket_id or null"
    }
}
```

Key features:
- Uses UUID v4 for game identification
- Tracks game configuration (X, T, K, mazeSize)
- Maintains player socket IDs for connection management
- Stores cookie positions as x,y coordinates
- Tracks game state (started, ended, winner)
- Manages trap locations (empty in example)

### 2. Spinwheel Data Structure
The spinwheel data appears to be stored in a gitignored file for persistence, likely containing sensitive or user-specific information. Based on the application's functionality, the expected structure would be:

```json
{
    "[wheelId]": {
        "id": "UUID string",
        "segments": ["string array of wheel segments"],
        "created": "timestamp",
        "lastModified": "timestamp"
    }
}
```

Note: The actual structure may vary as the file is not accessible for direct verification.

## Shared Infrastructure

### Backend Services
- Single Express.js server handling both games
- Unified Socket.IO implementation
- Shared static file serving
- Common rate limiting and security measures

### Frontend Resources
- Separate CSS styling for each game
- Independent HTML interfaces
- Game-specific JavaScript logic
- Shared Socket.IO client

## Security Considerations
1. Input validation and sanitization
2. Rate limiting for API endpoints
3. CORS policy implementation
4. No sensitive data exposure
5. Proper error handling

## Future Enhancement Possibilities
1. User authentication system
2. Custom wheel styling options
3. Wheel templates
4. History of spins
5. Advanced animation options
6. Mobile responsiveness improvements

Additional Game-Specific Enhancements:
1. **Maze Game**
   - Additional maze generation algorithms
   - More power-ups and obstacles
   - Tournament mode
   - Replay system
   - Custom maze editor

2. **Integration Features**
   - Unified user accounts
   - Cross-game achievements
   - Combined leaderboards
   - Game lobby system
