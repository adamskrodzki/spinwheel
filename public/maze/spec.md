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
    - `X`: Number of cookies required to win.
    - `T`: Cooldown (in seconds) for placing trap cookies.
    - `K`: Number of cookies present in the maze at any time.
    - `mazeSize`: (Optional) The size of the maze grid.
    - Other optional gameplay modifiers.
  - **Response:**
    - `gameId`: Unique identifier for the created game.
    - URL links for:
      - Viewer screen: `/maze/view/[gameId]`
      - Player 1 screen: `/maze/player1/[gameId]`
      - Player 2 screen: `/maze/player2/[gameId]`

### **3.2 Viewer Screen**
- **Endpoint:** `/maze/view/[gameId]`
  - **Purpose:** Provides a global view of the game for spectators.
  - **Behavior Before Players Join:**
    - Displays a **join screen** where two players can connect.
    - Shows a link for Player 1 and Player 2 to join (generated from `/maze/create`).
  - **Behavior After Players Join:**
    - Displays the global maze view:
      - Player positions.
      - Normal and trap cookies (with glowing effect for active traps).
      - Player scores and remaining lives.
      - Chat section for viewers.

### **3.3 Player Screens**
- **Endpoints:**
  - `/maze/player1/[gameId]`
  - `/maze/player2/[gameId]`
  - **Purpose:** Redirects joining players to individual views for gameplay.
  - **Features:**
    - Player-specific fog of war.
    - Movement controls (e.g., arrow keys or WASD).
    - HUD with score, lives, and trap cooldown timer.
    - Real-time updates for maze state (cookies, traps, etc.).

---

## **4. Revised Game Flow**

1. **Game Creation:**
   - A game is initialized via `/maze/create` with parameters for the game instance.
   - The response includes a unique `gameId` and links to the viewer and player screens.

2. **Spectator and Player Join:**
   - Spectators and potential players visit `/maze/view/[gameId]`.
   - Before players join:
     - A **join screen** allows two players to claim spots as Player 1 and Player 2.
   - After players join:
     - Spectators see the global game state.
     - Players are redirected to their respective URLs: `/maze/player1/[gameId]` and `/maze/player2/[gameId]`.

3. **Gameplay:**
   - Players compete to collect **X cookies** while avoiding traps.
   - Spectators observe and provide hints or distractions.
   - Game ends when one player collects **X cookies** or when one player runs out of lives.

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
- `/maze/player1/[gameId]` and `/maze/player2/[gameId]`: Player-specific views.

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