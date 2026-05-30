class MiniGameTaliyah extends Phaser.Scene {
    constructor() { super('MiniGameTaliyah'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.scrollX = 0;
        this.scrollSpeed = 1.5;
        this.hp = 3;
        this.maxHp = 3;
        this.gold = 0;
        this.invuln = 0;
        this.py = 600; // player Y
        this.gfx = this.add.graphics();

        // UI
        this.add.text(195, 20, "TALIYAH'S QUEST", { fontSize: '16px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.hpText = this.add.text(20, 45, '❤️❤️❤️', { fontSize: '16px' });
        this.goldText = this.add.text(320, 45, '🪙 0', { fontSize: '14px', color: '#ffaa00' });
        this.phaseText = this.add.text(195, 75, '', { fontSize: '12px', color: '#888' }).setOrigin(0.5);

        // Ground line
        this.groundY = 680;

        // Player (Taliyah - cyan square surfing)
        this.player = this.add.rectangle(80, this.py, 20, 24, 0x4ecca3).setDepth(10);
        // Surfboard
        this.add.rectangle(80, this.py + 14, 30, 6, 0x8b6914).setDepth(9);

        // Generate level segments
        this.segments = this.generateLevel();
        this.activeEntities = [];

        // Controls: tap top half = jump/dodge up, tap bottom half = attack/interact
        this.input.on('pointerdown', (p) => {
            if (this.done) return;
            if (p.y < 400) this.dodge(); // upper = dodge up
            else this.attack(); // lower = attack/last hit
        });
    }

    generateLevel() {
        const segs = [];
        let x = 400;

        // Phase 1: Last Hit (minions)
        for (let i = 0; i < 8; i++) {
            segs.push({ type: 'minion', x: x, hp: 100, maxHp: 100, alive: true });
            x += Phaser.Math.Between(120, 200);
        }

        // Phase 2: Skillshot Dodge
        x += 200;
        for (let i = 0; i < 6; i++) {
            const fromTop = Math.random() > 0.5;
            segs.push({ type: 'skillshot', x: x, fromTop, warned: false, fired: false, bulletY: fromTop ? 100 : this.groundY });
            x += Phaser.Math.Between(180, 280);
        }

        // Phase 3: Kiting (enemy chases)
        x += 200;
        segs.push({ type: 'kiter', x: x, enemyX: x + 300, enemyHp: 5, alive: true });

        // Phase 4: Bush Check
        x += 600;
        for (let i = 0; i < 5; i++) {
            const hasDanger = Math.random() > 0.4;
            segs.push({ type: 'bush', x: x, hasDanger, checked: false, revealed: false });
            x += 150;
        }

        // Treasure at end
        x += 300;
        segs.push({ type: 'treasure', x: x });
        return segs;
    }

    dodge() {
        // Quick dodge upward
        if (this.py > 500) {
            this.py = 500;
            this.time.delayedCall(400, () => { this.py = 600; });
        }
    }

    attack() {
        // Try to last-hit nearest minion or attack kiter
        for (const s of this.segments) {
            const screenX = s.x - this.scrollX;
            if (screenX < 40 || screenX > 200) continue;

            if (s.type === 'minion' && s.alive) {
                if (s.hp <= s.maxHp * 0.15) {
                    // Last hit!
                    s.alive = false;
                    this.gold++;
                    this.goldText.setText(`🪙 ${this.gold}`);
                } else {
                    // Too early
                    s.hp -= 20; // chip damage
                }
                return;
            }
            if (s.type === 'bush' && !s.checked) {
                s.checked = true;
                s.revealed = true;
                if (s.hasDanger) this.takeDamage();
                return;
            }
            if (s.type === 'kiter' && s.alive) {
                s.enemyHp--;
                if (s.enemyHp <= 0) { s.alive = false; this.gold += 3; this.goldText.setText(`🪙 ${this.gold}`); }
                return;
            }
        }
    }

    takeDamage() {
        if (this.invuln > 0) return;
        this.hp--;
        this.invuln = 60;
        this.hpText.setText('❤️'.repeat(this.hp) + '🖤'.repeat(this.maxHp - this.hp));
        if (window.Native) window.Native.vibrate(100);
        if (this.hp <= 0) this.die();
    }

    update() {
        if (this.done) return;
        this.scrollX += this.scrollSpeed;
        if (this.invuln > 0) this.invuln--;
        this.player.y = this.py;
        this.player.setAlpha(this.invuln > 0 && this.invuln % 6 < 3 ? 0.3 : 1);

        this.gfx.clear();
        // Ground
        this.gfx.lineStyle(2, 0x4ecca3);
        this.gfx.lineBetween(0, this.groundY, 390, this.groundY);

        // Determine phase
        let phase = '';

        for (const s of this.segments) {
            const sx = s.x - this.scrollX;
            if (sx < -100 || sx > 500) continue;

            if (s.type === 'minion' && s.alive) {
                phase = 'LAST HIT — tap when HP is low!';
                // Minion walks and loses HP over time
                s.hp -= 0.3;
                if (s.hp <= 0) { s.alive = false; continue; } // missed CS
                // Draw minion
                const hpRatio = s.hp / s.maxHp;
                this.gfx.fillStyle(hpRatio < 0.15 ? 0xffaa00 : 0xe94560);
                this.gfx.fillRect(sx - 8, this.groundY - 30, 16, 20);
                // HP bar
                this.gfx.fillStyle(0x333333);
                this.gfx.fillRect(sx - 12, this.groundY - 40, 24, 4);
                this.gfx.fillStyle(hpRatio < 0.15 ? 0xffaa00 : 0xff0000);
                this.gfx.fillRect(sx - 12, this.groundY - 40, 24 * hpRatio, 4);
            }

            if (s.type === 'skillshot') {
                phase = 'DODGE — tap top to dodge!';
                if (sx < 300 && !s.warned) { s.warned = true; }
                if (sx < 150 && !s.fired) {
                    s.fired = true;
                    s.bulletY = s.fromTop ? 100 : this.groundY;
                }
                if (s.fired) {
                    // Bullet moves toward player Y
                    const targetY = 600;
                    s.bulletY += (s.fromTop ? 4 : -4);
                    this.gfx.fillStyle(0xff4444, 0.8);
                    this.gfx.fillCircle(sx, s.bulletY, 8);
                    // Warning line
                    if (s.warned && !s.fired) {
                        this.gfx.lineStyle(1, 0xff0000, 0.3);
                        this.gfx.lineBetween(sx, s.fromTop ? 100 : this.groundY, sx, targetY);
                    }
                    // Hit check
                    if (Math.abs(sx - 80) < 20 && Math.abs(s.bulletY - this.py) < 25) {
                        this.takeDamage();
                        s.fired = false; // consume
                    }
                }
            }

            if (s.type === 'kiter' && s.alive) {
                phase = 'KITE — tap to attack, dodge to avoid!';
                // Enemy chases
                s.enemyX -= 0.5;
                const esx = s.enemyX - this.scrollX;
                this.gfx.fillStyle(0x9900cc);
                this.gfx.fillRect(esx - 12, this.groundY - 35, 24, 28);
                this.gfx.fillStyle(0xff0000);
                this.gfx.fillRect(esx - 12, this.groundY - 45, 24 * (s.enemyHp / 5), 4);
                // Hit player if too close
                if (Math.abs(esx - 80) < 25) this.takeDamage();
            }

            if (s.type === 'bush') {
                phase = 'BUSH — tap to check (careful!)';
                if (!s.revealed) {
                    this.gfx.fillStyle(0x006600, 0.7);
                    this.gfx.fillRect(sx - 20, this.groundY - 50, 40, 45);
                    this.gfx.fillStyle(0x008800);
                    this.gfx.fillCircle(sx, this.groundY - 55, 18);
                } else {
                    this.gfx.fillStyle(s.hasDanger ? 0xff0000 : 0x00aa00, 0.4);
                    this.gfx.fillRect(sx - 20, this.groundY - 50, 40, 45);
                    this.add.text(sx, this.groundY - 60, s.hasDanger ? '💀' : '✓', { fontSize: '14px' }).setOrigin(0.5);
                }
            }

            if (s.type === 'treasure') {
                phase = 'REACH THE TREASURE!';
                this.gfx.fillStyle(0xffaa00);
                this.gfx.fillRect(sx - 15, this.groundY - 40, 30, 30);
                this.gfx.fillStyle(0xffdd00);
                this.gfx.fillRect(sx - 8, this.groundY - 35, 16, 20);
                if (sx < 100) this.win();
            }
        }

        this.phaseText.setText(phase);
    }

    die() {
        this.done = true;
        this.add.rectangle(195, 400, 280, 180, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe94560);
        this.add.text(195, 360, '💀 Slain!', { fontSize: '22px', color: '#e94560' }).setOrigin(0.5).setDepth(31);
        this.add.text(195, 395, `Gold: ${this.gold}`, { fontSize: '14px', color: '#ffaa00' }).setOrigin(0.5).setDepth(31);
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
        this.add.text(195, 400, `🏆 GG! Gold: ${this.gold}`, { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(20);
        this.add.text(195, 440, '✓ Page Unlocked!', { fontSize: '18px', color: '#4ecca3' }).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
