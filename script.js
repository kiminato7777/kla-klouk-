const SYMBOLS = {
    tiger: '🐅',
    gourd: '🍐',
    rooster: '🐓',
    crab: '🦀',
    fish: '🐟',
    shrimp: '🦐'
};

const SYMBOL_KEYS = Object.keys(SYMBOLS);

// DOM Elements
const appContainer = document.getElementById('app-container');
const plateContainer = document.getElementById('plate-container');
const bowlCover = document.getElementById('bowl-cover');
const ambientGlow = document.getElementById('ambient-glow');
const instructionText = document.getElementById('instruction-text');

// Audio (Optional, can be added later, currently placeholder)
const shakeSound = document.getElementById('shake-sound');
const revealSound = document.getElementById('reveal-sound');

// State machine
// 0 = Ready to shake (cover closed)
// 1 = Shaking (animating)
// 2 = Ready to open (cover closed, done shaking)
// 3 = Opened (cover open, results visible)
let state = 0; 
let currentResults = [];

// Secret Cheat State
let forceResults = [null, null, null];
let selectedCheatSlots = [null, null, null];
let cheatMode = 'once'; // 'once' or 'always'
let showIndicator = true; // true or false

let secretTapCount = 0;
let secretTapTimer = null;
let longPressTimer = null;
let twoFingerTimer = null;

// Advanced Invisible Cheat State
let invisibleCheatActive = false;
let invisibleCheatBuffer = [];

const secretTrigger = document.getElementById('secret-trigger');
const secretPanel = document.getElementById('secret-panel');
const btnSaveCheat = document.getElementById('btn-save-cheat');

// Initial setup
resetTopDice();

appContainer.addEventListener('touchstart', handleTouchStart);
appContainer.addEventListener('touchend', handleTouchEnd);
appContainer.addEventListener('click', handleClick);

function handleTouchStart(e) {
    // 1. Double finger hold anywhere (1.2 seconds) to open the Admin Cheat Panel
    if (e.touches.length === 2) {
        clearTimeout(twoFingerTimer);
        twoFingerTimer = setTimeout(() => {
            selectedCheatSlots = [...forceResults]; // Load current active cheats
            secretPanel.classList.add('show');
            updateCheatPanelUI();
            if (navigator.vibrate) navigator.vibrate([100, 100]); // Short double vibration
        }, 1200);
        return;
    }

    // 2. Single touch - Top-Right corner long press for invisible cheat mode
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (touch.clientX > window.innerWidth - 80 && touch.clientY < 80) {
            longPressTimer = setTimeout(() => {
                invisibleCheatActive = true;
                invisibleCheatBuffer = [];
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Double vibrate to confirm active
            }, 1500); // 1.5 seconds hold
        }
    }
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (e.touches.length < 2) {
        clearTimeout(twoFingerTimer);
    }
}

function handleClick(e) {
    // If Invisible Cheat Mode is active, intercept clicks to record dice
    if (invisibleCheatActive) {
        const x = e.clientX;
        const y = e.clientY;
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        let selectedSymbol = '';
        if (y < h / 3) {
            selectedSymbol = x < w / 2 ? 'tiger' : 'gourd';
        } else if (y < (h / 3) * 2) {
            selectedSymbol = x < w / 2 ? 'rooster' : 'crab';
        } else {
            selectedSymbol = x < w / 2 ? 'fish' : 'shrimp';
        }
        
        invisibleCheatBuffer.push(selectedSymbol);
        if (navigator.vibrate) navigator.vibrate(30); // small vibrate
        
        if (invisibleCheatBuffer.length === 3) {
            forceResults = [...invisibleCheatBuffer];
            invisibleCheatActive = false;
            updateStealthIndicator();
            if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50, 200]); // Success vibration
        }
        return; // Block normal game click
    }

    // Ignore clicks if panel is open or if clicking the trigger or within the panel
    if (secretPanel.classList.contains('show') || e.target === secretTrigger || secretPanel.contains(e.target)) return;

    // Normal game flow
    initAudio(); // Initialize audio context on first user interaction
    
    if (state === 0) {
        startShake();
    } else if (state === 2) {
        revealDice();
    } else if (state === 3) {
        closeCover();
    }
}

// UI Secret Cheat Logic (Clicking top-left 3 times)
secretTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    secretTapCount++;
    clearTimeout(secretTapTimer);
    
    if (secretTapCount >= 3) {
        selectedCheatSlots = [...forceResults]; // Load current active cheats
        secretPanel.classList.add('show');
        updateCheatPanelUI();
        secretTapCount = 0;
        if (navigator.vibrate) navigator.vibrate(50);
    } else {
        secretTapTimer = setTimeout(() => {
            secretTapCount = 0;
        }, 1000);
    }
});

// Update the indicator on screen based on active cheat
function updateStealthIndicator() {
    const stealthInd = document.getElementById('stealth-indicator');
    if (!stealthInd) return;
    
    const hasActiveCheat = forceResults.some(val => val !== null);
    if (hasActiveCheat && showIndicator) {
        stealthInd.classList.add('active');
    } else {
        stealthInd.classList.remove('active');
    }
}

// Update the visual state of the Cheat Panel
function updateCheatPanelUI() {
    for (let i = 0; i < 3; i++) {
        const slotEl = document.getElementById(`slot-${i}`);
        if (!slotEl) continue;
        const val = selectedCheatSlots[i];
        if (val) {
            slotEl.innerHTML = '';
            slotEl.className = `cheat-slot face-${val}`;
        } else {
            slotEl.innerHTML = '❓';
            slotEl.className = 'cheat-slot';
        }
    }
    
    // Highlight active mode buttons
    document.getElementById('btn-mode-once').classList.toggle('active', cheatMode === 'once');
    document.getElementById('btn-mode-always').classList.toggle('active', cheatMode === 'always');
    
    // Highlight active indicator buttons
    document.getElementById('btn-indicator-on').classList.toggle('active', showIndicator);
    document.getElementById('btn-indicator-off').classList.toggle('active', !showIndicator);
}

// Add Grid Selection Click Handlers
document.querySelectorAll('.cheat-grid-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = item.getAttribute('data-symbol');
        
        // Find first empty slot (null)
        const emptyIdx = selectedCheatSlots.indexOf(null);
        if (emptyIdx !== -1) {
            selectedCheatSlots[emptyIdx] = symbol;
            updateCheatPanelUI();
            if (navigator.vibrate) navigator.vibrate(30);
        }
    });
});

// Add Slot Clear Click Handlers (Click a slot to reset it to random)
document.querySelectorAll('.cheat-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(slot.getAttribute('data-slot'));
        selectedCheatSlots[idx] = null;
        updateCheatPanelUI();
        if (navigator.vibrate) navigator.vibrate(30);
    });
});

// Save Cheat Handler
btnSaveCheat.addEventListener('click', (e) => {
    e.stopPropagation();
    forceResults = [...selectedCheatSlots];
    secretPanel.classList.remove('show');
    updateStealthIndicator();
    if (navigator.vibrate) navigator.vibrate([50, 100]);
});

// Clear/Reset Cheat Handler
document.getElementById('btn-clear-cheat').addEventListener('click', (e) => {
    e.stopPropagation();
    selectedCheatSlots = [null, null, null];
    forceResults = [null, null, null];
    updateCheatPanelUI();
    updateStealthIndicator();
    if (navigator.vibrate) navigator.vibrate(80);
});

// Mode / Option Toggles
document.getElementById('btn-mode-once').addEventListener('click', (e) => {
    e.stopPropagation();
    cheatMode = 'once';
    updateCheatPanelUI();
});

document.getElementById('btn-mode-always').addEventListener('click', (e) => {
    e.stopPropagation();
    cheatMode = 'always';
    updateCheatPanelUI();
});

document.getElementById('btn-indicator-on').addEventListener('click', (e) => {
    e.stopPropagation();
    showIndicator = true;
    updateCheatPanelUI();
    updateStealthIndicator();
});

document.getElementById('btn-indicator-off').addEventListener('click', (e) => {
    e.stopPropagation();
    showIndicator = false;
    updateCheatPanelUI();
    updateStealthIndicator();
});

// Close panel if click is registered outside of the panel
document.addEventListener('click', (e) => {
    if (secretPanel.classList.contains('show') && !secretPanel.contains(e.target) && e.target !== secretTrigger) {
        secretPanel.classList.remove('show');
    }
});

function startShake() {
    state = 1; // shaking
    instructionText.style.opacity = '0';
    
    // reset top dice question marks (flip to front)
    resetTopDice();
    
    // Add violent shaking animation to plate
    plateContainer.classList.add('shaking');
    
    // Add tumbling animation to inner dice
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`die-${i}`).classList.add('tumbling');
    }
    
    // Play sound if possible
    playShakeSound();
    
    // Stop shaking after 1.2s (dynamic, fast feel)
    setTimeout(() => {
        plateContainer.classList.remove('shaking');
        
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`die-${i}`).classList.remove('tumbling');
        }
        
        // Randomize dice values silently while covered
        randomizeDice();
        
        state = 2; // ready to open
        instructionText.textContent = "TAP TO OPEN";
        instructionText.style.opacity = '1';
    }, 1200);
}

function randomizeDice() {
    // Generate 3 random results
    currentResults = [];
    for (let i = 1; i <= 3; i++) {
        let randomSymbol = SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)];
        
        // Apply cheat if set
        if (forceResults[i-1] !== null) {
            randomSymbol = forceResults[i-1];
        }
        
        currentResults.push(randomSymbol);
        
        // Update plate dice content and styling
        const die = document.getElementById(`die-${i}`);
        const dieContent = die.querySelector('.die-content');
        dieContent.innerHTML = ''; // Clear text
        
        // Remove old classes and add new symbol class
        dieContent.className = `die-content face-${randomSymbol}`;
        
        // Randomize resting rotation for realistic look
        const rotZ = Math.random() * 40 - 20; // Slight rotation
        dieContent.style.transform = `rotateZ(${rotZ}deg)`;
    }
    
    // Clear cheats after one use if 'once' mode is active
    if (cheatMode === 'once') {
        forceResults = [null, null, null]; 
    }
    
    // Update the stealth indicator after applying/clearing cheats
    updateStealthIndicator();
}

function revealDice() {
    state = 3; // opened
    instructionText.style.opacity = '0';
    
    // Toss cover
    bowlCover.classList.add('open');
    
    // Ambient glow effect
    ambientGlow.classList.add('active');
    
    playRevealSound();
    
    // Wait for cover to start flying away, then flip the top dice!
    setTimeout(() => {
        for (let i = 1; i <= 3; i++) {
            setTimeout(() => {
                const topDieCube = document.getElementById(`top-die-${i}`);
                const emoji = topDieCube.querySelector('.result-emoji');
                
                // Update text and styling (empty text, rely on background)
                emoji.innerHTML = '';
                
                // Add colored background to the back face
                const backFace = topDieCube.querySelector('.back');
                backFace.className = `face back face-${currentResults[i-1]}`;
                
                // Flip animation!
                topDieCube.classList.add('revealed');
                
                // Haptic feedback per die flip
                if (navigator.vibrate) navigator.vibrate(30);
                
            }, i * 150); // Stagger the flips for premium feel
        }
    }, 300);
    
    setTimeout(() => {
        instructionText.textContent = "TAP TO CLOSE";
        instructionText.style.opacity = '1';
    }, 1500);
}

function closeCover() {
    state = 0; // ready to shake
    instructionText.style.opacity = '0';
    
    // Close cover
    bowlCover.classList.remove('open');
    ambientGlow.classList.remove('active');
    
    // Flip top dice back to question mark when cover closes
    setTimeout(() => {
        resetTopDice();
        setTimeout(() => {
            instructionText.textContent = "TAP TO SHAKE";
            instructionText.style.opacity = '1';
        }, 300);
    }, 400); // wait until cover is almost down
}

function resetTopDice() {
    for (let i = 1; i <= 3; i++) {
        const topDieCube = document.getElementById(`top-die-${i}`);
        topDieCube.classList.remove('revealed');
    }
}

// Physical Device Shaking Logic
let lastX = null, lastY = null, lastZ = null;
let shakeThreshold = 15; // Sensitivity
let lastShakeTime = 0;

window.addEventListener('devicemotion', (e) => {
    if (state !== 0) return; // Only shake if ready
    
    let acc = e.accelerationIncludingGravity;
    if (!acc.x) return;
    
    if (lastX !== null) {
        let deltaX = Math.abs(acc.x - lastX);
        let deltaY = Math.abs(acc.y - lastY);
        let deltaZ = Math.abs(acc.z - lastZ);
        
        if (deltaX + deltaY + deltaZ > shakeThreshold) {
            let now = Date.now();
            if (now - lastShakeTime > 1000) {
                lastShakeTime = now;
                startShake();
            }
        }
    }
    lastX = acc.x;
    lastY = acc.y;
    lastZ = acc.z;
});

// ==========================================
// AUDIO SYNTHESIS (No external files needed)
// ==========================================
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playShakeSound() {
    initAudio();
    // Simulate shaking 3 dice in a ceramic bowl
    let clackCount = 18;
    for(let i=0; i<clackCount; i++) {
        setTimeout(() => {
            createClack();
        }, Math.random() * 1000); // spread over 1 second
    }
}

function createClack() {
    if(!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 0.08; // 80ms duration
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    // Generate decaying white noise
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize / 4)); 
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    // Filter to make it sound like hard plastic/wood hitting ceramic
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500 + Math.random() * 1000;
    filter.Q.value = 1.5;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 1.2;
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noise.start();
}

function playRevealSound() {
    initAudio();
    // Magic reveal swish/chime
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}
