class MiniGameDig extends Phaser.Scene {
    constructor() { super('MiniGameDig'); }

    init(data) { this.levelIndex = data.levelIndex ?? 0; }

    create() {
        const cx = this.scale.width / 2;
        this.shakeTime = 0;
        this.required = 15;
        this.shaking = false;
        this.done = false;

        this.add.text(cx, 80, 'DIG', { fontSize: '36px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(cx, 140, 'Shake your phone to dig!', { fontSize: '16px', color: '#888' }).setOrigin(0.5);

        this.progressBg = this.add.rectangle(cx, 420, 300, 30, 0x16213e).setStrokeStyle(2, 0xe94560);
        this.progressFill = this.add.rectangle(cx - 148, 420, 0, 26, 0xe94560).setOrigin(0, 0.5);

        this.timerText = this.add.text(cx, 470, '0.0 / 15.0s', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
        this.statusText = this.add.text(cx, 550, '📱 Start shaking!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5);

        // Listen for device motion
        this.shakeThreshold = 15;
        this.motionHandler = (e) => {
            const a = e.accelerationIncludingGravity;
            if (!a) return;
            const force = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
            this.shaking = force > this.shakeThreshold;
        };
        window.addEventListener('devicemotion', this.motionHandler);
    }

    update(time, delta) {
        if (this.done) return;

        if (this.shaking) {
            this.shakeTime += delta / 1000;
            this.statusText.setText('🔥 DIGGING!').setColor('#e94560');
            if (window.Native) window.Native.vibrate(50);
        } else {
            this.statusText.setText('📱 Shake harder!').setColor('#4ecca3');
        }

        const progress = Math.min(this.shakeTime / this.required, 1);
        this.progressFill.width = 296 * progress;
        this.timerText.setText(`${this.shakeTime.toFixed(1)} / ${this.required}.0s`);

        if (this.shakeTime >= this.required) {
            this.done = true;
            this.win();
        }
    }

    win() {
        window.removeEventListener('devicemotion', this.motionHandler);
        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        const cx = this.scale.width / 2;
        this.statusText.setText('⛏️ You dug through!').setColor('#4ecca3');
        this.add.text(cx, 650, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }

    shutdown() {
        window.removeEventListener('devicemotion', this.motionHandler);
    }
}
