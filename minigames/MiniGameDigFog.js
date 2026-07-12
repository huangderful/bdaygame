// DIGFOG — fog-maze navigation where movement costs energy you generate by
// digging (shaking the phone). Merges the old MiniGameDig (shake detection) and
// MiniGameFog (maze + fog-of-war). Hitting a wall in the fog = LOSE.
class MiniGameDigFog extends Phaser.Scene {
    constructor() { super('MiniGameDigFog'); }

    init(data) { this.levelIndex = data.levelIndex ?? 6; }

    preload() { FeedbackFX.preload(this); }

    create() {
        this.done = false;

        // --- tunables ---
        this.TIME_LIMIT = DevConfig.time(122);      // 2 minutes 2 seconds
        this.MAX_ENERGY = 2.0;      // seconds of movement energy
        this.FILL_RATE = 1.5;       // energy gained per second while shaking
        this.SHAKE_THRESHOLD = 15;  // devicemotion force to count as shaking
        this.fogRadius = 50;

        // In dev: the first N wall hits are forgiven instead of losing.
        this.wallForgiveness = DevConfig.on ? 2 : 0;
        this.statusFlashUntil = 0;  // keep forgiveness message on screen briefly
        this.forgiveGraceUntil = 0; // post-forgiveness grace so one drag can't burn every charge

        // --- energy / shake state ---
        this.energy = 0;
        this.shaking = false;       // devicemotion
        this.barShaking = false;    // long-press on energy bar (dev fallback)
        this.moved = false;         // moved this frame -> drain energy

        // ---------- Maze (below the fog) — randomly generated each run ----------
        // Scene restart ([ Retry ]) re-runs create(), so every attempt gets a
        // fresh maze. Playfield: x 30..350, y 100..740 → 5x8 grid of 64x80
        // cells with 10px walls. Corridor clearance with the 7px ball
        // inflation in hitsWall(): 64 - 10 - 2*7 = 40px ≥ 35px everywhere.
        this.MAZE_COLS = 5; this.MAZE_ROWS = 8;
        this.MAZE_X = 30; this.MAZE_Y = 100;
        this.CELL_W = 64; this.CELL_H = 80;
        this.WALL_T = 10;

        this.walls = this.generateMazeWalls();
        const gfx = this.add.graphics().setDepth(1);
        gfx.fillStyle(0x222244);
        for (const w of this.walls) gfx.fillRect(w.x, w.y, w.w, w.h);

        // Goal — center of the bottom-right cell.
        const goal = this.mazeCellCenter(this.MAZE_COLS - 1, this.MAZE_ROWS - 1);
        this.add.circle(goal.x, goal.y, 10, 0xffaa00).setDepth(2);
        this.goalX = goal.x; this.goalY = goal.y;

        // Player — center of the top-left cell.
        const start = this.mazeCellCenter(0, 0);
        this.px = start.x; this.py = start.y;
        this.player = this.add.circle(this.px, this.py, 7, 0x4ecca3).setDepth(5);

        // ---------- Fog overlay (four rects around a visibility circle) ----------
        this.fog = this.add.graphics().setDepth(10);

        // ---------- HUD (above the fog: NOT darkened) ----------
        const cx = this.scale.width / 2;
        this.add.text(cx, 24, 'DIGFOG', { fontSize: '24px', color: '#e63030', fontStyle: 'bold' })
            .setOrigin(0.5).setDepth(20);
        this.timerText = this.add.text(cx, 48, '', { fontSize: '16px', color: '#888' })
            .setOrigin(0.5).setDepth(20);
        this.statusText = this.add.text(cx, 70, '', { fontSize: '12px', color: '#4ecca3' })
            .setOrigin(0.5).setDepth(20);

        // Energy bar
        this.barW = 260;
        this.energyBg = this.add.rectangle(cx, 92, this.barW, 14, 0x16213e)
            .setStrokeStyle(2, 0xe63030).setDepth(20);
        this.energyFill = this.add.rectangle(cx - this.barW / 2, 92, 0, 10, 0x4ecca3)
            .setOrigin(0, 0.5).setDepth(20);

        // Long-press on the energy bar = shaking (subtle desktop fallback)
        this.energyBg.setInteractive({ useHandCursor: true });
        this.energyBg.on('pointerdown', () => { this.barShaking = true; });
        this.energyBg.on('pointerup', () => { this.barShaking = false; });
        this.energyBg.on('pointerout', () => { this.barShaking = false; });

        // ---------- Input ----------
        // Drag to move — consumes energy, blocked at 0, wall contact = LOSE.
        this.input.on('pointermove', (p) => {
            if (this.done || this.barShaking || !p.isDown || this.energy <= 0) return;
            const dx = (p.x - p.prevPosition.x) * 0.8;
            const dy = (p.y - p.prevPosition.y) * 0.8;
            if (dx === 0 && dy === 0) return;
            // Sweep the move in <=4px steps so a fast flick can't tunnel through a wall.
            const startX = this.px, startY = this.py; // pre-move position (known safe)
            const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
            for (let i = 1; i <= steps; i++) {
                const nx = this.px + dx * (i / steps), ny = this.py + dy * (i / steps);
                if (this.hitsWall(nx, ny)) {
                    // Just-forgiven grace window: block the move, no charge, no loss.
                    if (this.time.now < this.forgiveGraceUntil) { this.px = startX; this.py = startY; return; }
                    if (this.wallForgiveness > 0) { this.forgiveWallHit(startX, startY); return; }
                    this.loss('💥 You hit a wall!'); return;
                }
                this.px = nx; this.py = ny;
            }
            this.moved = true;
        });
        this.input.on('pointerup', () => { this.barShaking = false; });

        // SPACE key = shaking (desktop dev fallback)
        if (this.input.keyboard) {
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }

        // devicemotion shake detection (mobile)
        this.motionHandler = (e) => {
            const a = e.accelerationIncludingGravity;
            if (!a) return;
            const force = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
            this.shaking = force > this.SHAKE_THRESHOLD;
        };
        window.addEventListener('devicemotion', this.motionHandler);
        this.events.once('shutdown', this.cleanup, this);
        this.events.once('destroy', this.cleanup, this);

        this.startTime = null; // stamped on first update tick (create-time clock can be stale)
        this.drawFog(); // cover the maze immediately (before the first update tick)
    }

    // Build a perfect maze (recursive-backtracker DFS) over the cell grid and
    // return it as {x,y,w,h} wall rects. The DFS carves a spanning tree over
    // the cells, so every cell is reachable from every other cell — the maze
    // is always solvable regardless of the random choices.
    generateMazeWalls() {
        const cols = this.MAZE_COLS, rows = this.MAZE_ROWS;
        const mx = this.MAZE_X, my = this.MAZE_Y;
        const cw = this.CELL_W, ch = this.CELL_H, t = this.WALL_T;

        // vOpen[r][c] = passage carved between (c,r) and (c+1,r);
        // hOpen[r][c] = passage carved between (c,r) and (c,r+1).
        const vOpen = Array.from({ length: rows }, () => new Array(cols - 1).fill(false));
        const hOpen = Array.from({ length: rows - 1 }, () => new Array(cols).fill(false));

        const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
        const stack = [[0, 0]];
        visited[0][0] = true;
        while (stack.length) {
            const [c, r] = stack[stack.length - 1];
            const neighbors = [];
            if (c > 0 && !visited[r][c - 1]) neighbors.push([c - 1, r]);
            if (c < cols - 1 && !visited[r][c + 1]) neighbors.push([c + 1, r]);
            if (r > 0 && !visited[r - 1][c]) neighbors.push([c, r - 1]);
            if (r < rows - 1 && !visited[r + 1][c]) neighbors.push([c, r + 1]);
            if (!neighbors.length) { stack.pop(); continue; }
            const [nc, nr] = Phaser.Utils.Array.Shuffle(neighbors)[0];
            if (nc !== c) vOpen[r][Math.min(c, nc)] = true;
            else hOpen[Math.min(r, nr)][c] = true;
            visited[nr][nc] = true;
            stack.push([nc, nr]);
        }

        // Border walls (same rects as the old hardcoded maze border).
        const walls = [
            { x: mx, y: my, w: cols * cw + t, h: t },             // top
            { x: mx, y: my + rows * ch, w: cols * cw + t, h: t }, // bottom
            { x: mx, y: my, w: t, h: rows * ch + t },             // left
            { x: mx + cols * cw, y: my, w: t, h: rows * ch + t }, // right
        ];

        // Interior walls wherever no passage was carved. Each rect is extended
        // by the wall thickness so it covers the 10x10 corner posts at BOTH of
        // its ends — junctions overlap instead of meeting edge-to-edge, so
        // there are no 1px diagonal gaps the ball could slip through.
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - 1; c++) {
                if (!vOpen[r][c]) walls.push({ x: mx + (c + 1) * cw, y: my + r * ch, w: t, h: ch + t });
            }
        }
        for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < cols; c++) {
                if (!hOpen[r][c]) walls.push({ x: mx + c * cw, y: my + (r + 1) * ch, w: cw + t, h: t });
            }
        }
        return walls;
    }

    // Center of a cell's open interior. Walls sit on the low-x/low-y edge of
    // each cell pitch, so the open area is the pitch minus one wall thickness.
    mazeCellCenter(col, row) {
        return {
            x: this.MAZE_X + col * this.CELL_W + this.WALL_T + (this.CELL_W - this.WALL_T) / 2,
            y: this.MAZE_Y + row * this.CELL_H + this.WALL_T + (this.CELL_H - this.WALL_T) / 2,
        };
    }

    hitsWall(x, y) {
        // Inflate walls by the player radius (7) so any visual contact = loss.
        for (const w of this.walls) {
            if (x > w.x - 7 && x < w.x + w.w + 7 && y > w.y - 7 && y < w.y + w.h + 7) return true;
        }
        return false;
    }

    // Dev-only (wallForgiveness starts at 0 in prod, so this never runs there):
    // absorb a wall hit instead of losing. Restores the pre-move position (known
    // safe, so the ball can't end up inside a wall), flashes the player, and
    // reports how many forgiven hits remain. Loss only happens once exhausted.
    forgiveWallHit(safeX, safeY) {
        this.wallForgiveness--;

        // Snap back to the pre-move position.
        this.px = safeX; this.py = safeY;
        this.player.setPosition(safeX, safeY);

        FeedbackFX.playNegative(this);
        if (window.Native && window.Native.vibrate) window.Native.vibrate(80);

        // Flash the player.
        this.tweens.killTweensOf(this.player);
        this.player.setAlpha(1);
        this.tweens.add({
            targets: this.player,
            alpha: { from: 1, to: 0.15 },
            duration: 90,
            yoyo: true,
            repeat: 3,
            onComplete: () => { if (this.player.active) this.player.setAlpha(1); },
        });

        // Grace window: pointermove fires continuously mid-drag, so without this
        // a single push into a wall would drain every forgiveness in a few frames.
        this.forgiveGraceUntil = this.time.now + 700;

        // Show remaining forgiven hits over the normal status line for a moment.
        this.statusFlashUntil = this.time.now + 1500;
        this.statusText
            .setText(`💥 Wall hit forgiven — ${this.wallForgiveness} left`)
            .setColor('#ffaa00');
    }

    update(time, delta) {
        if (this.done) return;
        const dt = delta / 1000;

        // Fill energy while shaking (devicemotion / SPACE / bar long-press).
        const shaking = this.shaking || (this.spaceKey && this.spaceKey.isDown) || this.barShaking;
        if (shaking && this.energy < this.MAX_ENERGY) {
            this.energy = Math.min(this.MAX_ENERGY, this.energy + this.FILL_RATE * dt);
            if (window.Native && window.Native.vibrate) window.Native.vibrate(30);
        }

        // Drain energy in real time while actively moving.
        if (this.moved && this.energy > 0) {
            this.energy = Math.max(0, this.energy - dt);
        }
        this.moved = false;

        // Sync player sprite.
        this.player.x = this.px; this.player.y = this.py;

        // Timer countdown.
        if (this.startTime === null) this.startTime = this.time.now;
        const remaining = Math.max(0, this.TIME_LIMIT - (this.time.now - this.startTime) / 1000);
        this.timerText.setText(`⏱ ${remaining.toFixed(1)}s`);
        if (remaining <= 0) { this.loss("⏰ Time's up!"); return; }

        // Energy bar.
        this.energyFill.width = this.barW * (this.energy / this.MAX_ENERGY);
        this.energyFill.setFillStyle(this.energy > 0 ? 0x4ecca3 : 0xe63030);
        if (this.time.now >= this.statusFlashUntil) { // don't stomp the forgiveness flash
            if (this.energy <= 0) this.statusText.setText('🔋 Out of energy — shake to dig!').setColor('#e63030');
            else if (shaking) this.statusText.setText('⛏️ Digging!').setColor('#4ecca3');
            else this.statusText.setText('Shake to dig ⚡  ·  drag ball to move').setColor('#888');
        }

        // Fog-of-war: four rects around the visibility circle.
        this.drawFog();

        // Reached goal?
        if (Phaser.Math.Distance.Between(this.px, this.py, this.goalX, this.goalY) < 18) this.win();
    }

    drawFog() {
        const r = this.fogRadius, px = this.px, py = this.py;
        this.fog.clear();
        this.fog.fillStyle(0x000000, 0.93);
        this.fog.fillRect(0, 0, 390, Math.max(0, py - r));                      // top
        this.fog.fillRect(0, py + r, 390, Math.max(0, 844 - (py + r)));         // bottom
        this.fog.fillRect(0, py - r, Math.max(0, px - r), r * 2);               // left
        this.fog.fillRect(px + r, py - r, Math.max(0, 390 - (px + r)), r * 2);  // right
    }

    win() {
        if (this.done) return;
        this.done = true;
        this.cleanup();
        this.fog.clear();

        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        FeedbackFX.playPositive(this);
        FeedbackFX.fountain(this, this.px, this.py, true);

        const cx = this.scale.width / 2;
        this.statusText.setText('🎉 You made it through the fog!').setColor('#4ecca3');
        this.add.text(cx, 420, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' })
            .setOrigin(0.5).setDepth(30);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }

    loss(msg) {
        if (this.done) return;
        this.done = true;
        this.cleanup();
        this.fog.clear();

        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, this.px, this.py, false);

        this.showFailModal(msg);
    }

    showFailModal(msg) {
        const cx = this.scale.width / 2;
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 380, msg, { fontSize: '18px', color: '#e63030' }).setOrigin(0.5).setDepth(31);
        this.add.text(cx, 430, '[ Retry ]', {
            fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 480, '[ Back ]', {
            fontSize: '18px', color: '#888'
        }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    cleanup() {
        if (this.motionHandler) {
            window.removeEventListener('devicemotion', this.motionHandler);
            this.motionHandler = null;
        }
    }
}
