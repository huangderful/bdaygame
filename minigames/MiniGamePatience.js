class MiniGamePatience extends Phaser.Scene {
    constructor() { super('MiniGamePatience'); }

    init(data) { this.levelIndex = data.levelIndex ?? 3; }

    preload() {
        this.load.image('shade', 'img/shade.png');
        this.load.image('player_spr', 'img/player.png');
        this.load.image('spike_blue', 'img/spike_blue.png');
        this.load.image('spike_red', 'img/spike_red.png');
    }

    create() {
        const W = 390, H = 844, cx = W / 2;
        this.done = false;
        this.frames = 0;
        this.moveDir = { x: 0, y: 0 };

        // Arena - square
        const arenaSize = 370;
        this.arenaX = (W - arenaSize) / 2; this.arenaY = 50;
        this.arenaW = arenaSize; this.arenaH = arenaSize;
        this.arenaCx = this.arenaX + this.arenaW / 2;
        this.arenaCy = this.arenaY + this.arenaH / 2;

        // Patience controller timing (from o_patience/Create_0.gml)
        this.shadeShootDelay = 180; // frames between shots
        this.shadeResetDelay = 600; // full reset cycle length
        this.shootTimer = 60;       // initial shoot delay
        this.resetTimer = 300;      // starts at 300, resets trigger when == 300
        this.currentShot = 0;
        this.dragsToWin = 5;
        this.dragCount = 0;

        // Immediately put shades in reset (matches frame 0 behavior)
        this.firstFrame = true;

        // Player stats (from o_player/Create_0.gml)
        this.playerHp = 1000;
        this.playerMaxHp = 1000;
        this.playerDef = 40;
        this.playerSpeed = 5; // walk_speed ≈ 5px/frame at spd=60
        this.bleed = 0;
        this.curse = 0;

        // Scale factor (game runs at ~60fps, Phaser at 60fps, but arena is smaller)
        this.scale_f = 0.6; // scale speeds for smaller arena

        // Draw arena
        this.add.rectangle(this.arenaCx, this.arenaCy, this.arenaW, this.arenaH, 0x0a0a1a).setStrokeStyle(2, 0x4ecca3);
        this.add.text(cx, 40, 'PATIENCE', { fontSize: '18px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);

        // HP bar
        this.hpBarBg = this.add.rectangle(cx, this.arenaY + this.arenaH + 20, 300, 20, 0x333333);
        this.hpBarFill = this.add.rectangle(cx - 150, this.arenaY + this.arenaH + 20, 300, 18, 0x4ecca3).setOrigin(0, 0.5);
        this.hpText = this.add.text(cx, this.arenaY + this.arenaH + 20, '1000 / 1000', { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        this.statusText = this.add.text(cx, this.arenaY + this.arenaH + 45, '', { fontSize: '12px', color: '#e94560' }).setOrigin(0.5);

        // Player
        this.player = this.add.sprite(this.arenaCx, this.arenaCy, 'player_spr').setDepth(5).setScale(3);
        this.bleedIcon = this.add.text(0, 0, '🩸', { fontSize: '10px' }).setDepth(50).setVisible(false);
        this.curseIcon = this.add.text(0, 0, '💀', { fontSize: '10px' }).setDepth(50).setVisible(false);

        // 4 Shades (from o_shade/Create_0.gml)
        this.shades = [];
        const spread = 80;
        const positions = [
            { x: this.arenaCx - spread, y: this.arenaCy - spread },
            { x: this.arenaCx + spread, y: this.arenaCy - spread },
            { x: this.arenaCx - spread, y: this.arenaCy + spread * 0.5 },
            { x: this.arenaCx + spread, y: this.arenaCy + spread * 0.5 },
        ];
        for (let i = 0; i < 4; i++) {
            const s = this.add.sprite(positions[i].x, positions[i].y, 'shade').setDepth(4).setScale(2);
            s.ogx = positions[i].x; s.ogy = positions[i].y;
            s.shadeId = i;
            s.state = 'reset'; // start in reset (from Create_0)
            s.numResets = 0;
            s.chaseSpd = 40;  // px/sec - feels right for small arena
            s.resetSpd = 60;  // faster return to origin
            this.shades.push(s);
        }

        // Spikes
        this.spikes = [];

        // Controls
        this.createJoystick(195, 0);

        // Drag counter
        this.dragText = this.add.text(195, this.arenaY + this.arenaH + 65, `Drags: 0 / ${this.dragsToWin}`, { fontSize: '14px', color: '#4ecca3' }).setOrigin(0.5);

        // Invulnerability flash
        this.invulnFrames = 60;
    }

    createJoystick(joyX, joyY) {
        this.moveX = 0;
        this.moveY = 0;
        this.touchStart = null;

        // Trackpad visual - black region filling bottom of screen
        const padY = 500;
        const padH = 344; // fills to bottom (844 - 500)
        this.add.rectangle(195, padY + padH / 2, 390, padH, 0x000000).setDepth(19);
        this.add.text(195, padY + 20, 'drag to move', { fontSize: '12px', color: '#444' }).setOrigin(0.5).setDepth(20);
        this.trackDot = this.add.circle(195, padY + padH / 2, 10, 0x4ecca3, 0.5).setDepth(20).setVisible(false);

        // Global input - no zones
        this.input.on('pointerdown', (p) => {
            if (p.y > padY) {
                this.touchStart = { x: p.x, y: p.y };
                this.trackDot.setPosition(p.x, p.y).setVisible(true);
            }
        });

        this.input.on('pointermove', (p) => {
            if (!p.isDown || !this.touchStart) return;
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

    update(time, delta) {
        if (this.done) return;
        this.frames++;
        if (this.invulnFrames > 0) this.invulnFrames--;

        // Bleed damage (0.3/frame from o_player/Step_0)
        if (this.bleed > 0) {
            this.bleed--;
            if (this.playerHp > 1) this.playerHp -= 0.3;
        }
        this.curse = Math.max(0, this.curse - 1);

        // Death check
        if (this.playerHp <= 0) { this.die(); return; }

        // Move player (walk_speed ≈ 5, scaled)
        const spd = this.playerSpeed * this.scale_f;
        this.player.x = Phaser.Math.Clamp(this.player.x + (this.moveX || 0) * spd, this.arenaX + 10, this.arenaX + this.arenaW - 10);
        this.player.y = Phaser.Math.Clamp(this.player.y + (this.moveY || 0) * spd, this.arenaY + 10, this.arenaY + this.arenaH - 10);

        // Shade behavior (from o_shade/Step_0 - SOLO mode)
        for (const s of this.shades) {
            if (s.state === 'chasing') {
                // Solo mode: chase player (no distance check - arena is small)
                const angle = Math.atan2(this.player.y - s.y, this.player.x - s.x);
                s.x += Math.cos(angle) * s.chaseSpd * (delta / 1000);
                s.y += Math.sin(angle) * s.chaseSpd * (delta / 1000);
            } else if (s.state === 'reset') {
                const dist = Phaser.Math.Distance.Between(s.x, s.y, s.ogx, s.ogy);
                if (dist > 2) {
                    const angle = Math.atan2(s.ogy - s.y, s.ogx - s.x);
                    s.x += Math.cos(angle) * s.resetSpd * (delta / 1000);
                    s.y += Math.sin(angle) * s.resetSpd * (delta / 1000);
                } else { s.x = s.ogx; s.y = s.ogy; }
            }
            s.x = Phaser.Math.Clamp(s.x, this.arenaX + 15, this.arenaX + this.arenaW - 15);
            s.y = Phaser.Math.Clamp(s.y, this.arenaY + 15, this.arenaY + this.arenaH - 15);

            // Shade contact damage (sitting on shade = constant damage)
            if (this.invulnFrames <= 0 && Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y) < 18) {
                this.takeDamage(50, 'BLEED');
            }
        }

        // Shoot timer (from o_patience/Step_0)
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.fireSpikes();
            this.shootTimer = this.shadeShootDelay;
        }

        // Reset timer (from o_patience/Step_0: decrement, check == 300 for reset, == 0 for chase)
        if (this.firstFrame) {
            // Frame 0: reset_delay starts at 300, which == 300, so shades reset immediately
            for (const s of this.shades) { s.state = 'reset'; s.numResets++; }
            this.dragCount++;
            this.firstFrame = false;
        }
        this.resetTimer--;
        if (this.resetTimer === 0) {
            // Shades start chasing, reset the timer
            for (const s of this.shades) s.state = 'chasing';
            this.resetTimer = this.shadeResetDelay; // 600
        }
        if (this.resetTimer === 300) {
            // Mid-cycle: shades reset back to origin (the "drag")
            for (const s of this.shades) { s.state = 'reset'; s.numResets++; }
            this.dragCount++;
            if (this.dragCount > this.dragsToWin) { this.win(); return; }
            this.dragText.setText(`Drags: ${this.dragCount} / ${this.dragsToWin}`);
        }

        // Move spikes (from o_spike/Step_0 - lifetime countdown)
        for (let i = this.spikes.length - 1; i >= 0; i--) {
            const sp = this.spikes[i];
            sp.lifetime--;
            if (sp.lifetime <= 0) { sp.obj.destroy(); this.spikes.splice(i, 1); continue; }
            sp.obj.x += sp.vx;
            sp.obj.y += sp.vy;
            // Out of arena
            if (sp.obj.x < this.arenaX - 20 || sp.obj.x > this.arenaX + this.arenaW + 20 ||
                sp.obj.y < this.arenaY - 20 || sp.obj.y > this.arenaY + this.arenaH + 20) {
                sp.obj.destroy(); this.spikes.splice(i, 1); continue;
            }
            // Hit player
            if (this.invulnFrames <= 0 && !sp.hasHit && Phaser.Math.Distance.Between(this.player.x, this.player.y, sp.obj.x, sp.obj.y) < 12) {
                sp.hasHit = true;
                this.takeDamage(sp.damage, sp.condition);
                sp.obj.destroy(); this.spikes.splice(i, 1);
            }
        }

        // Update HP bar
        const hpRatio = Math.max(0, this.playerHp / this.playerMaxHp);
        this.hpBarFill.width = 300 * hpRatio;
        this.hpBarFill.setFillStyle(hpRatio > 0.5 ? 0x4ecca3 : hpRatio > 0.25 ? 0xffaa00 : 0xe94560);
        this.hpText.setText(`${Math.ceil(this.playerHp)} / ${this.playerMaxHp}`);

        // Status effects display
        const statuses = [];
        if (this.bleed > 0) statuses.push(`BLEED ${Math.ceil(this.bleed / 60)}s`);
        if (this.curse > 0) statuses.push(`CURSE ${Math.ceil(this.curse / 60)}s`);
        this.statusText.setText(statuses.join(' | '));

        // Flash player when hit
        this.player.setAlpha(this.invulnFrames > 0 && this.frames % 6 < 3 ? 0.3 : 1);

        // Status indicators above player
        this.bleedIcon.setVisible(this.bleed > 0).setPosition(this.player.x - 8, this.player.y - 25);
        this.curseIcon.setVisible(this.curse > 0).setPosition(this.player.x + 8, this.player.y - 25);
    }

    takeDamage(rawDmg, condition) {
        // PIERCE ignores defense, CURSE doubles damage
        let dmg = rawDmg;
        if (condition !== 'PIERCE') dmg = Math.max(0, dmg - this.playerDef);
        if (this.curse > 0) dmg *= 2;

        this.playerHp -= dmg;
        this.invulnFrames = 30;

        // Floating damage text
        const dmgText = this.add.text(this.player.x, this.player.y - 20, `-${Math.round(dmg)}`, {
            fontSize: '12px', color: '#ff4444', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({ targets: dmgText, y: dmgText.y - 30, alpha: 0, duration: 800, onComplete: () => dmgText.destroy() });

        // Apply condition
        if (condition === 'BLEED') this.bleed = 180; // 3 seconds of bleed
        if (condition === 'CURSE') this.curse = 300; // 5 seconds of curse

        if (window.Native) window.Native.vibrate(50);
    }

    fireSpikes() {
        // 16 projectiles per shade, 22.5° apart (from o_shade shoot function)
        const isBlue = this.currentShot % 2 === 0;
        const key = isBlue ? 'spike_blue' : 'spike_red';
        const damage = isBlue ? 70 : 100;
        const condition = isBlue ? 'PIERCE' : 'CURSE';
        const spikeSpeed = 1.5; // px/frame

        for (const s of this.shades) {
            for (let i = 0; i < 16; i++) {
                const angle = i * (Math.PI * 2 / 16); // 22.5° increments
                const obj = this.add.sprite(s.x, s.y, key).setDepth(6).setScale(1.5);
                this.spikes.push({
                    obj, damage, condition,
                    vx: Math.cos(angle) * spikeSpeed,
                    vy: Math.sin(angle) * spikeSpeed,
                    lifetime: 260, hasHit: false
                });
            }
        }
        this.currentShot++;
    }

    die() {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        this.player.setTint(0xff0000);
        const cx = 195, cy = 400;
        this.add.rectangle(cx, cy, 280, 180, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe94560);
        this.add.text(cx, cy - 40, '💀 Dead!', { fontSize: '22px', color: '#e94560' }).setOrigin(0.5).setDepth(31);
        this.add.text(cx, cy - 10, `Survived ${Math.floor(this.frames / 60)}s`, { fontSize: '14px', color: '#888' }).setOrigin(0.5).setDepth(31);
        this.add.text(cx, cy + 25, '[ Retry ]', {
            fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, cy + 65, '[ Back ]', { fontSize: '16px', color: '#888' })
            .setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 380, '✓ Patience complete!', { fontSize: '20px', color: '#4ecca3' }).setOrigin(0.5).setDepth(10);
        this.add.text(195, 420, `Survived ${Math.floor(this.frames / 60)}s`, { fontSize: '14px', color: '#888' }).setOrigin(0.5).setDepth(10);
        this.add.text(195, 450, '✓ Page Unlocked!', { fontSize: '18px', color: '#4ecca3' }).setOrigin(0.5).setDepth(10);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
