// Shared game rendering logic
const MazeRenderer = {
    renderGame: function(canvas, gameState, playerView = null) {
        if (!canvas || !gameState) return;

        const ctx = canvas.getContext('2d');
        
        // Calculate the maximum possible canvas size while maintaining aspect ratio
        const maxSize = Math.min(
            canvas.parentElement.clientWidth * 0.95,
            canvas.parentElement.clientHeight * 0.95
        );
        
        // Set canvas to a constant size
        canvas.width = maxSize;
        canvas.height = maxSize;
        
        // Calculate cell size based on maze dimensions
        const cellSize = maxSize / (gameState.config.mazeSize + 1); // +1 for extra border
        
        // Set font for emojis
        ctx.font = `${Math.floor(cellSize * 0.8)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate visible cells for player view
        const visibleCells = new Set();
        if (playerView) {
            for (let dy = -gameState.config.viewRadius; dy <= gameState.config.viewRadius; dy++) {
                for (let dx = -gameState.config.viewRadius; dx <= gameState.config.viewRadius; dx++) {
                    const x = playerView.position.x + dx;
                    const y = playerView.position.y + dy;
                    if (x >= 0 && x <= gameState.config.mazeSize && 
                        y >= 0 && y <= gameState.config.mazeSize) {
                        visibleCells.add(`${x},${y}`);
                    }
                }
            }
        }

        // Draw maze cells
        for (let y = 0; y <= gameState.config.mazeSize; y++) {
            for (let x = 0; x <= gameState.config.mazeSize; x++) {
                // Skip if not visible in player view
                if (playerView && !visibleCells.has(`${x},${y}`)) continue;

                // Handle border cells
                const cell = (x === gameState.config.mazeSize || y === gameState.config.mazeSize) 
                    ? 1 
                    : gameState.maze[y][x];

                // Draw cell
                ctx.fillStyle = cell === 1 ? '#666' : '#fff';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                
                // Add subtle grid lines
                ctx.strokeStyle = '#ddd';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // Draw cookies
        gameState.cookies.forEach(cookie => {
            if (playerView && !visibleCells.has(`${cookie.x},${cookie.y}`)) return;
            ctx.fillText('🍪',
                (cookie.x + 0.5) * cellSize,
                (cookie.y + 0.5) * cellSize
            );
        });

        // Draw trap cookies
        gameState.trapCookies.forEach(trap => {
            if (playerView && !visibleCells.has(`${trap.x},${trap.y}`)) return;
            const now = Date.now();
            if (now - trap.placedTime < 3000) {
                ctx.fillText('💥',
                    (trap.x + 0.5) * cellSize,
                    (trap.y + 0.5) * cellSize
                );
            } else {
                ctx.fillText('🍪',
                    (trap.x + 0.5) * cellSize,
                    (trap.y + 0.5) * cellSize
                );
            }
        });

        // Draw players
        gameState.players.forEach((p, index) => {
            if (playerView && !visibleCells.has(`${p.position.x},${p.position.y}`)) return;
            const playerEmoji = index === 0 ? '😎' : '🤖';
            const playerNumber = index + 1;
            
            // Draw player emoji
            ctx.fillText(playerEmoji,
                (p.position.x + 0.5) * cellSize,
                (p.position.y + 0.5) * cellSize
            );
            
            // Draw player number indicator
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(
                p.position.x * cellSize,
                p.position.y * cellSize,
                20,
                20
            );
            ctx.fillStyle = '#fff';
            ctx.font = '14px Arial';
            ctx.fillText(playerNumber,
                p.position.x * cellSize + 10,
                p.position.y * cellSize + 10
            );
            
            // Reset font for next emoji
            ctx.font = `${Math.floor(cellSize * 0.8)}px Arial`;
        });
    }
};
