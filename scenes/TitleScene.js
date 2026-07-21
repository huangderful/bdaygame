class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }

    create() {
        const cx = this.scale.width / 2;

        // Schedule birthday notification for July 21 12:00 AM Pacific (-07:00 = PDT in July).
        try {
            if (window.Native && window.Native.scheduleNotification) {
                const target = new Date('2026-07-21T00:00:00-07:00').getTime();
                const delay = target - Date.now();
                if (delay > 1000) {
                    window.Native.scheduleNotification('HAPPY BDAY WEBS!!!!!', 'Open plz!', delay);
                }
            }
        } catch(e) { console.error(e); }

        this.add.text(cx, 200, 'The Webs Archive', {
            fontSize: '32px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const firstTime = !localStorage.getItem(INTRO_SEEN_KEY);
        const levels = this.registry.get('levels') || [];
        // DEV_ALL_BEATEN forces beaten (robust even if the registry isn't
        // populated yet) and skips the first-time Play-only gate so the
        // Letter button is visible.
        const beaten = DevConfig.allBeaten ||
            (levels.length > 0 && levels.every(l => isLevelCompleted(l)));

        // First time: just Play (which runs the intro slideshow)
        if (firstTime && !DevConfig.allBeaten) {
            this.createButton(cx, 420, 'Play', () => this.scene.start('Intro'));
            return;
        }

        let y = 420;
        this.createButton(cx, y, 'Play', () => this.scene.start('LevelSelect')); y += 80;
        this.createButton(cx, y, 'Parts', () => this.scene.start('Parts')); y += 80;
        if (beaten) { this.createButton(cx, y, 'Letter', () => this.scene.start('Letter')); }

        // Tiny replay-intro button, top right
        this.add.text(378, 14, '↻ intro', { fontSize: '11px', color: '#666' })
            .setOrigin(1, 0).setInteractive({ useHandCursor: true })
            .on('pointerover', function () { this.setColor('#aaa'); })
            .on('pointerout', function () { this.setColor('#666'); })
            .on('pointerdown', () => this.scene.start('Intro'));
    }

    createButton(x, y, label, callback) {
        const btn = this.add.text(x, y, `[ ${label} ]`, {
            fontSize: '24px', color: '#e63030', backgroundColor: '#16213e',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setColor('#ffffff'));
        btn.on('pointerout', () => btn.setColor('#e63030'));
        btn.on('pointerdown', callback);
    }
}
