class MiniGameChain extends Phaser.Scene {
    constructor() { super('MiniGameChain'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.chain = 0;
        this.chainNeeded = 20;
        this.startTime = this.time.now;
        this.timeLimit = 30000;

        this.add.text(195, 40, 'CHAIN', { fontSize: '24px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 75, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.chainText = this.add.text(195, 110, '0 / 20', { fontSize: '18px', color: '#4ecca3' }).setOrigin(0.5);
        this.questionText = this.add.text(195, 300, '', { fontSize: '36px', color: '#fff' }).setOrigin(0.5);
        this.feedbackText = this.add.text(195, 550, '', { fontSize: '20px' }).setOrigin(0.5);

        this.buttons = [];
        this.showQuestion();
    }

    showQuestion() {
        const a = Phaser.Math.Between(1, 20), b = Phaser.Math.Between(1, 20);
        const ops = ['+', '-', '×'];
        const op = ops[Phaser.Math.Between(0, 2)];
        let answer;
        if (op === '+') answer = a + b;
        else if (op === '-') answer = a - b;
        else answer = a * b;

        this.questionText.setText(`${a} ${op} ${b}`);

        // Two choices
        const wrong = answer + Phaser.Math.Between(1, 5) * (Math.random() > 0.5 ? 1 : -1);
        const choices = Math.random() > 0.5 ? [answer, wrong] : [wrong, answer];

        this.buttons.forEach(b => b.destroy());
        this.buttons = [];

        choices.forEach((val, i) => {
            const x = 120 + i * 150;
            const btn = this.add.text(x, 430, `${val}`, {
                fontSize: '30px', color: '#1a1a2e', backgroundColor: '#4ecca3', padding: { x: 25, y: 12 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => this.answer(val === answer));
            this.buttons.push(btn);
        });
    }

    answer(correct) {
        if (this.done) return;
        if (correct) {
            this.chain++;
            this.chainText.setText(`${this.chain} / ${this.chainNeeded}`);
            this.feedbackText.setText('✓').setColor('#4ecca3');
            if (this.chain >= this.chainNeeded) { this.win(); return; }
        } else {
            this.chain = 0;
            this.chainText.setText('0 / 20 — BROKEN!');
            this.feedbackText.setText('✗ Chain broken!').setColor('#e94560');
        }
        this.time.delayedCall(200, () => { this.feedbackText.setText(''); this.showQuestion(); });
    }

    update() {
        if (this.done) return;
        const elapsed = this.time.now - this.startTime;
        const remaining = Math.max(0, (this.timeLimit - elapsed) / 1000);
        this.timerText.setText(`${remaining.toFixed(1)}s`);
        if (remaining <= 0) this.fail();
    }

    fail() {
        this.done = true;
        this.feedbackText.setText(`⏰ Time! Chain: ${this.chain}`).setColor('#e94560');
        this.add.text(195, 650, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.feedbackText.setText('✓ 20 chain! Page Unlocked!').setColor('#4ecca3');
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
