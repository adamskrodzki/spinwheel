Here is the full, ready-to-copy version of the specification:

---

# **Functional Specification: Cookie Heist Maze Game**

---

## **1. Overview**
**Cookie Heist Maze** is a multiplayer browser-based game for two active players and multiple spectators. Players compete to collect cookies while avoiding traps in a maze, with fog of war for players and a global view for spectators. The game features endpoints to dynamically initialize and manage game instances.

---

## **2. Gameplay Mechanics**

### **2.1 Objectives**
- Players aim to collect **X cookies** (e.g., 10) to win the game.
- Players can sabotage their opponent by placing **trap cookies** that reduce the opponent's lives.

### **2.2 Player Mechanics**
- **Lives:** Each player starts with **N lives** (e.g., 3). A life is lost if a player collects a trap cookie.
- **Cookie Collection:** Normal cookies add **+1 point** when collected.
- **Trap Cookies:** Players can drop a trap cookie every **T seconds** (e.g., 10 seconds). 
  - Trap cookies glow briefly (e.g., 3–5 seconds) after being placed, making them identifiable.
  - After glowing, trap cookies are indistinguishable from normal cookies.

### **2.3 Cookie Spawning**
- **Normal Cookies:** Always **K cookies** (e.g., 5) present in the maze at a time. When a cookie is collected, another spawns in a random position.
- **Trap Cookies:** Dropped manually by players, limited by cooldown (T seconds). Players cannot place more than one active trap cookie at a time.

### **2.4 Fog of War**
- Players see only a small radius around their current position in the maze.
- Viewers have access to a complete, unrestricted view of the maze.

---

## **3. Endpoints and Game Flow**

### **3.1 Game Creation**
- **Endpoint:** `/maze/create`
  - **Purpose:** Initializes a new game instance with parameters for gameplay.
  - **Request Parameters:**
    - `cookiesToWin`: Number of cookies required to win (default: 10).
    - `trapCooldown`: Cooldown in seconds for placing trap cookies (default: 10).
    - `activeCookies`: Number of cookies present in the maze at any time (default: 5).
    - `mazeSize`: The size of the maze grid (default: 15).
    - `lives`: Number of lives per player (default: 3).
    - `viewRadius`: Player's visible radius in fog of war (default: 5).
  - **Response:**
    - `gameId`: Unique identifier for the created game.
    - URLs for:
      - Viewer screen: `/maze/view/[gameId]`
      - Player screen: `/maze/player/[gameId]`
  - **Rate Limiting:** Maximum 10 game creations per minute per IP address.

### **3.2 Game Configuration**
- **Endpoint:** `/maze/game-config/[gameId]`
  - **Purpose:** Retrieves current game configuration and state.
  - **Response:**
    - Current game configuration
    - Game state
    - Number of connected players

### **3.3 Viewer Screen**
- **Endpoint:** `/maze/view/[gameId]`
- **Purpose:** Provides a global view of the game for spectators and serves as the game lobby.
- **Stage-Based Behavior:**
  1. **Before First Player (Lobby Stage)**
    - Displays welcome message and game configuration
    - Shows prominent "Join Game" button at the top
    - Displays empty maze grid with visual indicators for:
      - Cookie spawn points (dimmed)
      - Potential player starting positions (dimmed)
    - Shows game rules and controls explanation
    - Displays QR code/link for easy sharing

  2. **One Player Joined (Waiting Stage)**
    - "Join Game" button remains prominent for second player
    - Shows connected player's name/identifier
    - Displays "Waiting for Player 2..." message
    - Maze grid shows:
      - First player's starting position
      - Cookie spawn points (dimmed)
      - Animated waiting indicator

  3. **Game in Progress**
    - Removes join button
    - Shows full maze view with:
      - Both players' positions and movements in real-time
      - All cookies (normal and trap)
      - Visual effects for trap placement and collection
      - Player scores and lives
    - Displays game stats:
      - Time elapsed
      - Cookies collected by each player
      - Traps placed/triggered

  4. **Game Ended**
    - Players automatically redirected here from player view
    - Displays winner announcement with victory animation
    - Shows final scores and stats
    - Presents "Play Again" button (resets game for new players to join)
    - Shows game replay option
    - Displays match statistics:
      - Total cookies collected
      - Traps placed/triggered
      - Game duration
      - Winner's path visualization

### **3.4 Player Screen**
- **Endpoint:** `/maze/player/[gameId]`
- **Stage-Based Behavior:**
  1. **Before Game Start (Joining)**
    - Shows player number assignment (1 or 2)
    - Displays waiting screen with:
      - "Waiting for other player..." message
      - Animated loading indicator
      - Game controls tutorial
      - Game rules reminder

  2. **Game Ready (Both Players Present)**
    - Brief countdown timer (3-2-1)
    - Shows initial fog of war view
    - Displays HUD elements:
      - Lives counter
      - Score
      - Trap cooldown timer
      - Mini-map (if enabled in config)

  3. **During Gameplay**
    - Fog of war view (viewRadius tiles visible)
    - Real-time HUD updates:
      - Current score
      - Remaining lives
      - Trap cooldown status
      - Opponent's score
    - Visual/audio feedback for:
      - Cookie collection
      - Trap placement
      - Taking damage

  4. **Game Over**
    - Automatically redirects to viewer URL
    - Game continues in "Game Ended" state in viewer

## **4. Revised Game Flow**

1. **Game Creation and Setup:**
   - Host creates game via `/maze/create` with parameters
   - System generates:
     - Unique `gameId`
     - Maze layout

2. **Player Join Process:**
   - Players join through viewer screen
   - First player gets Player 1 status
   - Second player gets Player 2 status
   - Each player redirected to `/maze/player/[gameId]`
   - Both players must confirm ready status

3. **Game Initialization:**
   - 3-second countdown displayed to all
   - Initial cookie placement
   - Players placed at starting positions
   - Fog of war activated for players
   - Game timer starts

4. **Active Gameplay:**
   - Players navigate maze collecting cookies
   - Real-time updates for:
     - Player movements
     - Cookie collection/spawning
     - Trap placement/triggering
     - Score/lives changes
   - Spectators see global view
   - Players see fog of war view

5. **Game End Conditions:**
   - Player reaches target cookie count
   - Player loses all lives
   - Both players disconnect
   - Time limit reached (if configured)

6. **Post-Game:**
   - All players automatically redirected to viewer URL
   - Winner announced with victory animation
   - Stats displayed for all participants
   - Replay available for review
   - "Play Again" resets game for new players:
     - Clears current players
     - Resets maze and game state
     - Maintains same game ID and configuration

---

## **5. Technical Implementation**

### **5.1 Server-Side Logic**
- **Initialization:**
  - Handle `/maze/create` to generate game parameters and store the maze state (e.g., grid layout, cookies, player positions).
- **State Management:**
  - Maintain real-time updates for:
    - Player movements.
    - Cookie collection and spawning.
    - Trap placement and activation.
  - Use `gameId` to isolate game instances.

### **5.2 Socket.IO Integration**
- **Rooms:**
  - Each game instance gets its own room (`[gameId]`).
- **Channels:**
  - Player-specific updates for fog of war and HUD.
  - Global updates for the viewer screen.

### **5.3 Endpoints**
- `/maze/create`: Initializes game instance and returns links.
- `/maze/view/[gameId]`: Viewer screen with join functionality.
- `/maze/player/[gameId]`: Player-specific views.

---

## **6. UI Design**

### **6.1 Player View**
- **Fog of War:** Small radius showing part of the maze.
- **HUD:** Displays:
  - Score.
  - Remaining lives.
  - Trap cookie cooldown timer.
  - Cookies collected.

### **6.2 Viewer View**
- Full maze with:
  - Player locations.
  - All cookies (normal and trap, with glowing effect for active traps).
  - Player scores and remaining lives.
  - Chat or commentary section.

---

## **7. Key Features**
- **Real-Time Interaction:** Smooth updates via Socket.IO for players and viewers.
- **Spectator Engagement:** A shared global view enhances spectator involvement.
- **Simple, Replayable Gameplay:** Minimal rules and scalable design for quick games.

---

## **8. Next Steps**
1. **Implement `/maze/create`:**
   - Generate `gameId` and initialize game state with parameters.
2. **Set Up Socket.IO Rooms:**
   - Configure real-time updates for players and viewers.
3. **Develop Join Screen for `/maze/view/[gameId]`:**
   - Allow two players to claim spots and redirect to player views.
4. **Build Player and Viewer Interfaces:**
   - Player screens with fog of war and controls.
   - Viewer screen with global maze view and chat.

---

This is now a complete, copy-paste-ready specification for your project. Let me know if you'd like help implementing it!