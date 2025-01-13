// Constants and Configuration
const GAME_CONSTANTS = {
  REFERENCE_WIDTH: 1920,
  REFERENCE_HEIGHT: 1080,
  SCALE_MINIMUM: 0.5,
  RADIUS: {
    PLAYER: 30,
    ENEMY: 20,
    BULLET: 10,
    POWERUP: 30,
  },
  SPEED: {
    ENEMY: 2,
    BULLET: 10,
  },
  COLOR: {
    PLAYER: "blue",
    ENEMY: "red",
    BULLET: "yellow",
  },
  SHOOT_COOLDOWN: 250,
  POWERUP_SPAWN_INTERVAL: { min: 10000, max: 20000 },
  PLAYER_INVULNERABILITY_TIME: 2000,
  RAINBOW_MODE_DURATION: 5000,
};

// Canvas Scaling
let gameScale = 1;

const RADIUS_POWERUP = 30;

// SVG templates for hearts
const fullHeartSVG = `
              <svg class="heart" viewBox="0 0 24 24">
              <path class="heart-full" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>`;

const brokenHeartSVG = `
              <svg class="heart" viewBox="0 0 24 24">
              <path class="heart-broken" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              <path class="heart-broken" d="M12 5L9 9h6l-3 4"/>
              </svg>`;

// SVG for Heart
const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

// DOM Elements
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayButton = document.getElementById("overlayButton");
const infoText = document.getElementById("infoText");
const pauseText = document.getElementById("pauseText");
const heartsDisplay = document.getElementById("heartsDisplay");
const permissionButton = document.getElementById("permissionButton");
const pauseButton = document.getElementById("pauseButton");
const shootButton = document.getElementById("shootButton");

// Player Object
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: GAME_CONSTANTS.RADIUS.PLAYER,
  color: GAME_CONSTANTS.COLOR.PLAYER,
  direction: { x: 0, y: 1 },
  hearts: 3,
  invulnerable: false,
  consecutiveHearts: 0,
  isRainbowMode: false,
};

// Game Entities
const enemies = [];
const bullets = [];
const powerups = [];

// Game State Variables
let game = "start"; // Possible states: 'start', 'pause', 'game-over', 'error'
let controlMode = "none"; // Possible states: 'accelerometer' or 'mouse'
let paused = false;
let gameStarted = false;
let zombiesDefeated = 0;
let tiltX = 0;
let tiltY = 0;
let accelerometerValid = false; // Check if accelerometer works
let lastShootTime = 0;
let nextPowerupSpawn =
  Date.now() +
  Math.random() *
    (GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.max -
      GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.min) +
  GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.min;

/**
 * Sets the Canvas dimensions based on window size
 */
function setCanvasDimensions() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * Sets the game scale based on the canvas size
 */
function setGameScale() {
  const scaleX = canvas.width / GAME_CONSTANTS.REFERENCE_WIDTH;
  const scaleY = canvas.height / GAME_CONSTANTS.REFERENCE_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  if (scale < GAME_CONSTANTS.SCALE_MINIMUM) {
    gameScale = GAME_CONSTANTS.SCALE_MINIMUM;
  } else {
    gameScale = scale;
  }
}

/**
 * Scales the Game Elements based on the Game Scale
 */
function scaleGameElements() {
  setGameScale();

  // Maintain aspect ratio
  const scale = gameScale;

  // Scale player
  player.radius = GAME_CONSTANTS.RADIUS.PLAYER * scale;

  // Scale enemies
  enemies.forEach((enemy) => {
    enemy.radius = GAME_CONSTANTS.RADIUS.ENEMY * scale;
  });

  // Scale bullets
  bullets.forEach((bullet) => {
    bullet.radius = GAME_CONSTANTS.RADIUS.BULLET * scale;
  });

  // Scale power-ups
  powerups.forEach((powerup) => {
    powerup.radius = RADIUS_POWERUP * scale;
  });
}

/**
 * Handles the Resizing of the Canvas
 */
function handleResize() {
  setCanvasDimensions();
  scaleGameElements();
  updateUIElementsPosition();
}

/**
 * Initialize the Controls based on the device capabilities. Primary with accelerometer and fallback to mouse
 */
function initializeControls() {
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      permissionButton.style.display = "block";
      permissionButton.addEventListener("click", (event) => {
        requestAccelerometerPermission();
        // Prevent the click from triggering the document click handler
        event.stopPropagation();
      });
      infoText.innerText = "Click the button to enable Accelerometer control.";
    } else {
      controlMode = "accelerometer";
      window.addEventListener(
        "deviceorientation",
        handleOrientationWithRotation
      );
      infoText.innerText = "Accelerometer control enabled.";

      // Add a timeout to detect valid accelerometer data
      setTimeout(() => {
        if (!accelerometerValid) {
          fallbackToMouse();
        }
      }, 1000);
    }
  } else {
    fallbackToMouse();
  }
}

/**
 * Request the user for permission to use the accelerometer
 */
function requestAccelerometerPermission() {
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then((response) => {
        if (response === "granted") {
          controlMode = "accelerometer";
          window.addEventListener(
            "deviceorientation",
            handleOrientationWithRotation
          );
          permissionButton.style.display = "none";
        } else {
          fallbackToMouse();
        }
      })
      .catch(() => {
        fallbackToMouse();
      });
  } else {
    controlMode = "accelerometer";
    window.addEventListener("deviceorientation", handleOrientationWithRotation);

    // Add a timeout to detect if accelerometer provides valid data
    setTimeout(() => {
      if (!accelerometerValid) {
        fallbackToMouse();
      }
    }, 1000); // Check after 1 second
  }
}

/**
 * Fallback to Mouse controls if accelerometer is not available
 *
 * @returns {void}
 */
function fallbackToMouse() {
  if (isTouchDevice()) {
    showOverlay("error");
    return;
  }
  controlMode = "mouse";
  window.addEventListener("mousemove", handleMouseMove);
  permissionButton.style.display = "none";
  infoText.innerText =
    "Controlling with Mouse (Accelerometer unavailable or request denied)";
  pauseText.innerText = "Pause with ESC";
  pauseButton.style.display = "none";
}

/**
 * Hanldes the movement if user plays with mouse
 *
 * @param {*} event A MouseMove Event
 */
function handleMouseMove(event) {
  const x = (event.clientX / window.innerWidth) * 180 - 90;
  const y = (event.clientY / window.innerHeight) * 180 - 90;

  tiltX = x;
  tiltY = y;

  if (controlMode === "mouse") {
    infoText.innerText = "Controlling with Mouse";
  }
}

/**
 * Handles the accelermoeter movement in relation to orientation of the device
 *
 * @param {*} event A DeviceOrientation Event
 * @returns {void}
 */
function handleOrientationWithRotation(event) {
  if (event.gamma === null || event.beta === null) {
    fallbackToMouse();
    return;
  }

  accelerometerValid = true;

  const orientation =
    (screen.orientation || {}).type ||
    screen.msOrientation ||
    screen.mozOrientation ||
    window.orientation;

  let adjustedTiltX;
  let adjustedTiltY;

  // Handle different orientations
  switch (orientation) {
    case "landscape-primary":
    case 90: // For older browsers that use degrees
      adjustedTiltX = event.beta; // Use beta as X-axis tilt
      adjustedTiltY = -event.gamma; // Use negative gamma as Y-axis tilt
      break;

    case "landscape-secondary":
    case -90: // For older browsers that use degrees
      adjustedTiltX = -event.beta; // Use negative beta as X-axis tilt
      adjustedTiltY = event.gamma; // Use gamma as Y-axis tilt
      break;

    case "portrait-secondary":
    case 180:
      adjustedTiltX = -event.gamma; // Use negative gamma as X-axis tilt
      adjustedTiltY = -event.beta; // Use negative beta as Y-axis tilt
      break;

    case "portrait-primary":
    case 0:
    default:
      adjustedTiltX = event.gamma; // Use gamma as X-axis tilt
      adjustedTiltY = event.beta; // Use beta as Y-axis tilt
      break;
  }

  // Clamp the values to prevent excessive movement
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  tiltX = clamp(adjustedTiltX, -45, 45);
  tiltY = clamp(adjustedTiltY, -45, 45);

  if (controlMode === "accelerometer") {
    infoText.innerText = "Controlling with Accelerometer";
    pauseButton.style.display = "block";
    shootButton.style.display = "block";
  }
}

/**
 * Checks if the device is a touch device
 *
 * @returns {boolean} Returns true if the device is a touch device
 */
function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Draws the player on the canvas
 */
function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  // Calculate rotation based on direction
  const angle = Math.atan2(player.direction.y, player.direction.x);
  ctx.rotate(angle);

  // Update pulse effect if invulnerable
  if (player.invulnerable && !player.isRainbowMode) {
    player.pulsePhase += player.pulseSpeed;
    // Calculate red intensity based on sine wave
    const pulseIntensity = Math.sin(player.pulsePhase) * 0.5 + 0.5; // Values between 0 and 1
    const redIntensity = Math.floor(255 * (0.5 + pulseIntensity * 0.5)); // Keep red always visible
    player.color = `rgba(${redIntensity}, 0, 0, 0.8)`;

    // Add glow effect
    ctx.shadowColor = `rgba(255, 0, 0, ${pulseIntensity * 0.8})`;
    ctx.shadowBlur = 20;
  }

  // Draw player body
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.closePath();

  // Draw front (triangle)
  ctx.beginPath();
  ctx.moveTo(player.radius, 0);
  ctx.lineTo(player.radius / 2, -player.radius / 2);
  ctx.lineTo(player.radius / 2, player.radius / 2);
  ctx.closePath();
  ctx.fillStyle = player.invulnerable ? "rgba(255, 200, 200, 0.9)" : "white";
  ctx.fill();

  ctx.restore();
}

/**
 * Updates the player position based on the controls of the user
 */
function updatePlayer() {
  player.x += tiltX * 0.5;
  player.y += tiltY * 0.5;

  // Update direction
  if (tiltX !== 0 || tiltY !== 0) {
    const magnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
    player.direction.x = tiltX / magnitude;
    player.direction.y = tiltY / magnitude;
  }

  player.x = Math.max(
    player.radius,
    Math.min(canvas.width - player.radius, player.x)
  );
  player.y = Math.max(
    player.radius,
    Math.min(canvas.height - player.radius, player.y)
  );
}

/**
 * Spawn a new enemy at a random edge of the canvas
 */
function spawnZombie() {
  const side = Math.floor(Math.random() * 4);
  let x, y;

  if (side === 0) {
    x = Math.random() * canvas.width;
    y = -20;
  } else if (side === 1) {
    x = canvas.width + 20;
    y = Math.random() * canvas.height;
  } else if (side === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + 20;
  } else {
    x = -20;
    y = Math.random() * canvas.height;
  }

  enemies.push({
    x,
    y,
    radius: GAME_CONSTANTS.RADIUS.ENEMY * gameScale,
    color: GAME_CONSTANTS.COLOR.ENEMY,
    direction: { x: 0, y: 0 }, // Initialize direction
  });
}

/**
 * Draws the enemies on the canvas
 */
function drawEnemies() {
  enemies.forEach((enemy) => {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    const angle = Math.atan2(enemy.direction.y, enemy.direction.x);
    ctx.rotate(angle);

    // Draw body (circle)
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fillStyle = enemy.color;
    ctx.fill();
    ctx.closePath();

    // Draw front (triangle)
    ctx.beginPath();
    ctx.moveTo(enemy.radius, 0);
    ctx.lineTo(enemy.radius / 2, -enemy.radius / 2);
    ctx.lineTo(enemy.radius / 2, enemy.radius / 2);
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.fill();

    ctx.restore();
  });
}

/**
 * Updates the enemy positions based on the player position
 */
function updateEnemies() {
  enemies.forEach((enemy) => {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    enemy.x += (dx / dist) * GAME_CONSTANTS.SPEED.ENEMY;
    enemy.y += (dy / dist) * GAME_CONSTANTS.SPEED.ENEMY;

    // Update enemy direction
    enemy.direction.x = dx / dist;
    enemy.direction.y = dy / dist;
  });
}

/**
 * Shoots a bullet with a cooldown
 *
 * @returns {void}
 */
function shootBullets() {
  const currentTime = Date.now();
  const timeSinceLastShot = currentTime - lastShootTime;

  // Check if still in cooldown
  if (timeSinceLastShot < GAME_CONSTANTS.SHOOT_COOLDOWN) {
    return;
  }

  if (paused || !gameStarted) return;

  // Actual shooting logic
  const spread = Math.PI / 12;
  const baseAngle = Math.atan2(player.direction.y, player.direction.x);

  for (let i = -1; i <= 1; i++) {
    bullets.push({
      x: player.x,
      y: player.y,
      direction: {
        x: Math.cos(baseAngle + i * spread),
        y: Math.sin(baseAngle + i * spread),
      },
      radius: GAME_CONSTANTS.RADIUS.BULLET * gameScale,
      color: GAME_CONSTANTS.COLOR.BULLET,
    });
  }

  // Update last shoot time
  lastShootTime = currentTime;
}

/**
 * Draws the bullets on the canvas
 */
function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fillStyle = bullet.color;
    ctx.fill();
    ctx.closePath();
  });
}

/**
 * Updates the bullet positions
 */
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.direction.x * GAME_CONSTANTS.SPEED.BULLET;
    bullet.y += bullet.direction.y * GAME_CONSTANTS.SPEED.BULLET;

    // Remove bullets that go out of bounds
    if (
      bullet.x < 0 ||
      bullet.x > canvas.width ||
      bullet.y < 0 ||
      bullet.y > canvas.height
    ) {
      bullets.splice(i, 1);
    }
  }
}

/**
 * Spawn a new PowerUp at a random position one the canvas
 */
function spawnHeartPowerup() {
  // Spawn power-up at random position, keeping distance from edges
  const margin = 50;
  const x = margin + Math.random() * (canvas.width - 2 * margin);
  const y = margin + Math.random() * (canvas.height - 2 * margin);

  powerups.push({
    x,
    y,
    radius: RADIUS_POWERUP * gameScale,
    collected: false,
    creation: Date.now(),
    pulsePhase: 0,
  });

  // Schedule next spawn
  nextPowerupSpawn =
    Date.now() +
    Math.random() *
      (GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.max -
        GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.min) +
    GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.min;
}

/**
 * Draws the PowerUps on the canvas
 *
 * @param {*} powerup A {@link PowerUp} object
 */
function drawHeartPowerup(powerup) {
  ctx.save();

  // Add floating animation
  powerup.pulsePhase += 0.05;
  const floatOffset = Math.sin(powerup.pulsePhase) * 5;

  // Position and scale for the heart
  ctx.translate(powerup.x, powerup.y + floatOffset);
  ctx.scale(1.5, 1.5); // Make power-up heart slightly larger than HUD hearts

  const path = new Path2D(HEART_PATH);

  // Draw glowing effect
  ctx.shadowColor = "#ff3366";
  ctx.shadowBlur = 15;

  // Draw the heart
  ctx.fillStyle = "#ff3366";
  ctx.fill(path);

  ctx.restore();
}

/**
 * Updates the PowerUps and spawns new ones
 */
function updatePowerups() {
  // Check if it's time to spawn a new power-up
  if (Date.now() >= nextPowerupSpawn) {
    spawnHeartPowerup();
  }

  // Check for collection
  powerups.forEach((powerup, index) => {
    const dx = player.x - powerup.x;
    const dy = player.y - powerup.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < player.radius + powerup.radius) {
      // Collect power-up
      player.hearts = 3;
      updateHeartsDisplay();

      // Increment consecutive hearts and check for rainbow mode
      player.consecutiveHearts++;
      if (player.consecutiveHearts >= 3) {
        triggerRainbowMode();
        player.consecutiveHearts = 0; // Reset counter after triggering
      }

      // Add collection effect
      createCollectionEffect(powerup.x, powerup.y);

      // Remove power-up
      powerups.splice(index, 1);
    }
  });

  // Remove power-ups that have been around too long (30 seconds)
  const now = Date.now();
  for (let i = powerups.length - 1; i >= 0; i--) {
    if (now - powerups[i].creation > 30000) {
      powerups.splice(i, 1);
    }
  }
}

/**
 * Creates a Collection Effect on the given Coordinates
 *
 * @param {*} x Position x
 * @param {*} y Position y
 */
function createCollectionEffect(x, y) {
  // Add sparkle effect
  ctx.save();
  ctx.translate(x, y);

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const length = 15;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    ctx.strokeStyle = "#ff3366";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Updates the Heart Display based on the player's health
 */
function updateHeartsDisplay() {
  const heartsContainer = document.getElementById("heartsDisplay");
  heartsContainer.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const heartDiv = document.createElement("div");
    heartDiv.innerHTML = i < player.hearts ? fullHeartSVG : brokenHeartSVG;
    heartsContainer.appendChild(heartDiv);
  }
}

/**
 * Makes the Player Invulneravle agains Zombies
 */
function makePlayerInvulnerable() {
  player.invulnerable = true;
  player.pulsePhase = 0;
  player.pulseSpeed = 0.1; // Initial pulse speed
  const warningTime = 500; // Time in ms before invulnerability ends to start warning

  // Set a warning phase to speed up pulsing
  setTimeout(() => {
    if (player.invulnerable) {
      player.pulseSpeed = 0.3; // Faster pulse speed for warning phase
    }
  }, GAME_CONSTANTS.PLAYER_INVULNERABILITY_TIME - warningTime);

  // End invulnerability after the set time
  setTimeout(() => {
    player.invulnerable = false;
    player.color = "blue";
  }, GAME_CONSTANTS.PLAYER_INVULNERABILITY_TIME);
}

/**
 * Triggers the RainbowEffect for Player
 *
 */
function triggerRainbowMode() {
  if (player.isRainbowMode) return;

  player.isRainbowMode = true;
  player.invulnerable = true;

  // Apply rainbow effect
  let rainbowInterval = setInterval(() => {
    player.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
  }, 100);

  // Shoot bullets in all directions
  let rainbowShootInterval = setInterval(() => {
    for (let i = 0; i < 8; i++) {
      bullets.push({
        x: player.x,
        y: player.y,
        direction: {
          x: Math.cos((i / 8) * Math.PI * 2),
          y: Math.sin((i / 8) * Math.PI * 2),
        },
        radius: GAME_CONSTANTS.RADIUS.BULLET * gameScale,
        color: GAME_CONSTANTS.COLOR.BULLET,
      });
    }
  }, 300);

  // Stop rainbow mode after duration
  setTimeout(() => {
    player.isRainbowMode = false;
    player.invulnerable = false;
    clearInterval(rainbowInterval);
    clearInterval(rainbowShootInterval);
    player.color = "blue"; // Reset to default color
  }, GAME_CONSTANTS.RAINBOW_MODE_DURATION);
}

/**
 * Checks for collisions between {@link Bullet} - {@link Zombie} AND {@link Player} - {@link Zombie}
 *
 * @returns {void}
 */
function checkCollisions() {
  if (paused || !gameStarted) return;

  // Check bullet-enemy collisions
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    for (let j = bullets.length - 1; j >= 0; j--) {
      const bullet = bullets[j];
      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < enemy.radius + bullet.radius) {
        enemies.splice(i, 1);
        bullets.splice(j, 1);
        zombiesDefeated++; // Increment score
        break;
      }
    }
  }

  // Check player-enemy collisions
  enemies.forEach((zombie, index) => {
    const dx = player.x - zombie.x;
    const dy = player.y - zombie.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < player.radius + zombie.radius && !player.invulnerable) {
      player.hearts--;
      updateHeartsDisplay();
      player.consecutiveHearts = 0;

      if (player.hearts <= 0) {
        gameStarted = false;
        showOverlay("game-over");
      } else {
        makePlayerInvulnerable();
        enemies.splice(index, 1);
      }
    }
  });
}

/**
 * Displays the current Game State
 *
 * @param {*} state The state that should be displayed via the Overlay
 */
function showOverlay(state) {
  gameState = state;
  overlay.classList.add("active");

  if (state === "start") {
    overlayTitle.textContent = "Crimson Swarm";
    overlayMessage.innerHTML =
      "Use accelerometer or mouse to move<br>Click or tap to shoot<br>Collect hearts to restore your health";
    overlayButton.textContent = "Start Game";
    overlayButton.onclick = startGame;
  } else if (state === "pause") {
    overlayTitle.textContent = "Game Paused";
    overlayMessage.innerHTML = "Press ESC or Pause button to resume";
    overlayButton.textContent = "Resume Game";
    overlayButton.onclick = togglePause;
  } else if (state === "game-over") {
    overlayTitle.textContent = "Game Over";
    overlayMessage.textContent = `Enemies defeated: ${zombiesDefeated}`;
    overlayButton.textContent = "Play Again";
    overlayButton.onclick = startGame;
  } else if (state === "error") {
    overlayTitle.textContent = "Error";
    overlayMessage.textContent =
      "There was an error. The requst for the accelermoter was denied but your device is controlled via touchscreen. The game sadly doesn't support this.";
    overlayButton.textContent = "Restart Game";
    overlayButton.onclick = startGame;
  }
}

/**
 * Hides the current Overlay
 */
function hideOverlay() {
  overlay.classList.remove("active");
}

/**
 * Starts the Game
 */
function startGame() {
  gameStarted = true;
  hideOverlay();
  resetGame();

  // Re-initialize controls if they were lost
  if (controlMode === "none") {
    initializeControls();
  }
}

/**
 * Hides the current Overlay
 */
function resetGame() {
  // Reset player state
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.hearts = 3;
  player.invulnerable = false;
  player.color = "blue";
  player.direction = { x: 0, y: 1 };

  // Clear game arrays
  enemies.length = 0;
  bullets.length = 0;
  powerups.length = 0;
  zombiesDefeated = 0;

  // Reset game state
  paused = false;
  gameStarted = true;

  // Reset power-up spawn timer
  nextPowerupSpawn =
    Date.now() +
    Math.random() *
      (GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.max -
        GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.min) +
    GAME_CONSTANTS.POWERUP_SPAWN_INTERVAL.min;

  // Reset UI
  updateHeartsDisplay();

  // Reset acceleration/movement values
  tiltX = 0;
  tiltY = 0;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * The main game loop
 */
function gameLoop() {
  if (!paused && gameStarted && controlMode != "none") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPlayer();
    updatePlayer();
    drawEnemies();
    updateEnemies();
    drawBullets();
    updateBullets();

    powerups.forEach(drawHeartPowerup);
    updatePowerups();

    checkCollisions();
  }

  requestAnimationFrame(gameLoop);
}

/**
 * Toggles the Pause state of the game
 *
 * @returns {void}
 */
function togglePause() {
  if (!gameStarted) return;
  paused = !paused;
  if (!paused) {
    hideOverlay();
    gameState = "playing";
  } else {
    showOverlay("pause");
  }
}

/**
 * Handles Game Clicks so no shooting is possible when clicking on the overlay
 *
 * @param {*} event A Click Event
 * @returns {void}
 */
function handleGameClick(event) {
  const overlayButton = document.getElementById("overlayButton");
  const clickedElement = event.target;

  // Don't shoot if clicking on menu buttons
  if (clickedElement === overlayButton || clickedElement === permissionButton) {
    return;
  }

  // Only shoot if the game is active
  if (gameStarted && !paused) {
    shootBullets();
  }
}

document.addEventListener("click", handleGameClick);

shootButton.addEventListener("click", (event) => {
  if (gameStarted && !paused) {
    shootBullets();
  }
  // Prevent the click from triggering the document click handler
  event.stopPropagation();
});

pauseButton.addEventListener("click", (event) => {
  togglePause();
  // Prevent the click from triggering the document click handler
  event.stopPropagation();
});

// Handling pausing with escape
document.addEventListener("keydown", (event) => {
  if (controlMode === "mouse" && event.key === "Escape") {
    togglePause();
  }
});

// Handle orientation changes
window.addEventListener("orientationchange", () => {
  // Update canvas dimensions
  setCanvasDimensions();

  // Reset player position to center when orientation changes
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;

  // Reset tilt values to prevent unexpected movement during transition
  tiltX = 0;
  tiltY = 0;

  // Update UI elements position if needed
  updateUIElementsPosition();
});

// Handle window resizing
window.addEventListener("resize", handleResize);

/**
 * Updates the position of the UI Elements based on the window size
 */
function updateUIElementsPosition() {
  // Adjust the position of buttons and info elements based on new dimensions
  const safeAreaTop = "env(safe-area-inset-top, 10px)";
  const safeAreaRight = "env(safe-area-inset-right, 10px)";
  const safeAreaBottom = "env(safe-area-inset-bottom, 10px)";
  const safeAreaLeft = "env(safe-area-inset-left, 10px)";

  // Update controls position
  if (window.innerWidth > window.innerHeight) {
    // Landscape mode
    shootButton.style.left = safeAreaLeft;
    shootButton.style.bottom = "10px";
    pauseButton.style.right = safeAreaRight;
    pauseButton.style.bottom = "10px";
  } else {
    // Portrait mode
    shootButton.style.left = safeAreaLeft;
    shootButton.style.bottom = "20px";
    pauseButton.style.right = safeAreaRight;
    pauseButton.style.bottom = "20px";
  }
}

/**
 * Initializes the Game
 */
function init() {
  handleResize();
  setInterval(() => {
    if (gameStarted && !paused && controlMode != "none") {
      spawnZombie();
    }
  }, 1000);
  initializeControls();
  updateHeartsDisplay();
  showOverlay("start");
  gameLoop();
}

init();
