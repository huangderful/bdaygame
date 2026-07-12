// Dev mode switch. Flip to false for the real build:
//  - stage/question/round counts are capped at 2
//  - time limits stretch to 2m2s (122s), and games get extra chances
//  - reset buttons (per-level + global) appear in Level Select
const DEV_MODE = false;

// Display override: pretend every level is beaten, with 0 attempts and 0 time.
// Non-destructive (nothing is written to the save). Flip to false to disable.
const DEV_ALL_BEATEN = false;

const DevConfig = {
    on: DEV_MODE,
    allBeaten: DEV_ALL_BEATEN,
    // cap a stage/question/round count at 2 in dev
    stages(n) { return DEV_MODE ? Math.min(2, n) : n; },
    // stretch a time limit (seconds) to 2m2s in dev
    time(seconds) { return DEV_MODE ? 122 : seconds; },
};

// Shared stats helpers (used by LevelSelect + Parts).
// bdaygame_playtime: { levelIndex: cumulativeMs } — written in game.js on scene shutdown.
function getPlaytime() {
    if (DevConfig.allBeaten) return {};
    try { return JSON.parse(localStorage.getItem('bdaygame_playtime')) || {}; }
    catch (e) { return {}; }
}

// bdaygame_attempts: { levelIndex: count }.
function getAttemptsMap() {
    if (DevConfig.allBeaten) return {};
    try { return JSON.parse(localStorage.getItem('bdaygame_attempts')) || {}; }
    catch (e) { return {}; }
}

// Effective completion for DISPLAY — real save data is never modified by the
// override, so flipping DEV_ALL_BEATEN off restores the true state.
function isLevelCompleted(level) {
    return DevConfig.allBeaten || !!(level && level.completed);
}

// Small persistent ✕ in the top-left so games without an always-available
// fail modal (Chase, Guess, Spatial) can still be exited mid-run.
function addExitButton(scene) {
    return scene.add.text(14, 14, '✕', { fontSize: '20px', color: '#888' })
        .setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true })
        .on('pointerover', function () { this.setColor('#fff'); })
        .on('pointerout', function () { this.setColor('#888'); })
        .on('pointerdown', (p, lx, ly, event) => {
            event.stopPropagation();
            scene.scene.start('LevelSelect');
        });
}

// Count an extra attempt for a level (used by games with in-scene restarts —
// e.g. a CHASE mistype or a TRIVIA wrong answer — which don't re-run create()).
function bumpAttempts(levelIndex) {
    let a = {};
    try { a = JSON.parse(localStorage.getItem('bdaygame_attempts')) || {}; } catch (e) {}
    a[levelIndex] = (a[levelIndex] || 0) + 1;
    localStorage.setItem('bdaygame_attempts', JSON.stringify(a));
}

function formatPlaytime(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
}
