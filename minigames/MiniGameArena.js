class MiniGameArena extends Phaser.Scene {
    constructor() { super('MiniGameArena'); }
    init(data) { this.levelIndex = data.levelIndex; }

    preload() { FeedbackFX.preload(this); }

    create() {
        this.done = false;
        this.frames = 0;
        this.surviveFrames = (DevConfig.on ? 8 : 22) * 60;   // survive 22 seconds (8 in dev)
        this.shrinkFrames = 15 * 60;    // radius freezes at second 15
        this.cx = 195; this.cy = 330;   // arena in upper part of screen (top ~150, bottom ~510)
        this.radius = 180;
        this.px = this.cx; this.py = this.cy;
        this.playerSpeed = 3.5;
        this.enemySpeedScale = DevConfig.on ? 0.5 : 1; // enemies at half speed in dev
        this.enemies = [];
        this.gfx = this.add.graphics();

        // Starts with 3 balls; 8 more spawns spread over the first 15s so the
        // count reaches exactly 11 at t=15s. No spawns after second 15.
        // In dev: skip the extra spawns, keep only the initial 3 balls.
        this.spawnFrames = DevConfig.on ? [] : [113, 225, 338, 450, 563, 675, 788, 900];

        this.add.text(195, 30, 'ARENA', { fontSize: '20px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 60, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.ballText = this.add.text(195, 85, '', { fontSize: '14px', color: '#4ecca3' }).setOrigin(0.5);
        this.player = this.add.circle(this.px, this.py, 8, 0x4ecca3).setDepth(10);

        // Spawn initial enemies
        for (let i = 0; i < 3; i++) this.spawnEnemy();

        // Patience-style trackpad controls (finger off the ball)
        this.createJoystick();
    }

    createJoystick() {
        this.moveX = 0;
        this.moveY = 0;
        this.touchStart = null;

        // Trackpad visual - black region filling bottom of screen (below the arena)
        const padY = 560;
        const padH = 844 - padY; // fills to bottom
        this.add.rectangle(195, padY + padH / 2, 390, padH, 0x000000).setDepth(19);
        this.add.text(195, padY + 26, 'drag to move', { fontSize: '18px', color: '#bbb' }).setOrigin(0.5).setDepth(20);
        this.trackDot = this.add.circle(195, padY + padH / 2, 10, 0x4ecca3, 0.5).setDepth(20).setVisible(false);

        this.input.on('pointerdown', (p) => {
            if (this.done) return;
            if (p.y > padY) {
                this.touchStart = { x: p.x, y: p.y };
                this.trackDot.setPosition(p.x, p.y).setVisible(true);
            }
        });

        this.input.on('pointermove', (p) => {
            if (this.done || !p.isDown || !this.touchStart) return;
            const dx = p.x - this.touchStart.x;
            const dy = p.y - this.touchStart.y;
            const maxDist = 30;
            this.moveX = Phaser.Math.Clamp(dx / maxDist, -1, 1);
            this.moveY = Phaser.Math.Clamp(dy / maxDist, -1, 1);
            this.trackDot.setPosition(p.x, p.y).setVisible(true);
            this.touchStart.x += dx * 0.08;
            this.touchStart.y += dy * 0.08;
        });

        this.input.on('pointerup', () => {
            this.moveX = 0; this.moveY = 0;
            this.touchStart = null;
            this.trackDot.setVisible(false);
        });
    }

    spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const r = this.radius * 0.5;
        this.enemies.push({
            x: this.cx + Math.cos(angle) * r,
            y: this.cy + Math.sin(angle) * r,
            vx: Phaser.Math.FloatBetween(-2, 2) * this.enemySpeedScale,
            vy: Phaser.Math.FloatBetween(-2, 2) * this.enemySpeedScale
        });
        this.ballText.setText(`Balls: ${this.enemies.length}`);
    }

    update() {
        if (this.done) return;
        this.frames++;

        const remaining = (this.surviveFrames - this.frames) / 60;
        this.timerText.setText(`${Math.max(0, remaining).toFixed(1)}s`);
        if (this.frames >= this.surviveFrames) { this.win(); return; }

        // Shrink arena only during the first 15s, then freeze the radius.
        if (this.frames <= this.shrinkFrames) {
            this.radius = 180 - (this.frames / this.shrinkFrames) * 75; // 180 -> 105 at 15s
        }

        // Scheduled spawns (reach 11 balls at t=15s, none after).
        if (this.spawnFrames.includes(this.frames)) this.spawnEnemy();

        // Move player via trackpad joystick.
        const spd = this.playerSpeed;
        this.px += (this.moveX || 0) * spd;
        this.py += (this.moveY || 0) * spd;
        this.player.x = this.px; this.player.y = this.py;

        // Check player in arena (edge = death)
        const pDist = Phaser.Math.Distance.Between(this.px, this.py, this.cx, this.cy);
        if (pDist > this.radius - 10) { this.die(); return; }

        // Move enemies
        this.gfx.clear();
        this.gfx.lineStyle(2, 0xe63030);
        this.gfx.strokeCircle(this.cx, this.cy, this.radius);

        for (const e of this.enemies) {
            e.x += e.vx; e.y += e.vy;
            const eDist = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);
            if (eDist > this.radius - 8) {
                const angle = Math.atan2(e.y - this.cy, e.x - this.cx);
                e.vx = -Math.cos(angle) * 2 * this.enemySpeedScale;
                e.vy = -Math.sin(angle) * 2 * this.enemySpeedScale;
            }
            this.gfx.fillStyle(0xe63030, 0.8);
            this.gfx.fillCircle(e.x, e.y, 6);

            if (Phaser.Math.Distance.Between(this.px, this.py, e.x, e.y) < 14) { this.die(); return; }
        }
    }

    die() {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, this.px, this.py, false);
        this.player.setFillStyle(0xff0000);
        this.add.rectangle(195, 420, 280, 160, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe63030);
        this.add.text(195, 390, `💀 (${Math.floor(this.frames/60)}s)`, { fontSize: '20px', color: '#e63030' }).setOrigin(0.5).setDepth(31);
        this.add.text(195, 430, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(195, 475, '[ Back ]', { fontSize: '16px', color: '#888' }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        FeedbackFX.playPositive(this);
        FeedbackFX.fountain(this, this.px, this.py, true);
        this.add.text(195, 420, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
