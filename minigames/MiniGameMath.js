class MiniGameMath extends Phaser.Scene {
    constructor() { super('MiniGameMath'); }

    init(data) { this.levelIndex = data.levelIndex ?? 2; }

    create() {
        const cx = this.scale.width / 2;
        this.correct = 0;
        this.total = 15;
        this.timeLimit = 15;
        this.done = false;
        this.startTime = this.time.now;

        this.add.text(cx, 40, 'MATH', { fontSize: '36px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(cx, 90, '', { fontSize: '18px', color: '#888' }).setOrigin(0.5);
        this.progressText = this.add.text(cx, 130, '', { fontSize: '16px', color: '#4ecca3' }).setOrigin(0.5);
        this.questionText = this.add.text(cx, 280, '', { fontSize: '40px', color: '#ffffff' }).setOrigin(0.5);
        this.feedbackText = this.add.text(cx, 650, '', { fontSize: '20px' }).setOrigin(0.5);

        this.buttons = [];
        this.showQuestion();
    }

    showQuestion() {
        if (this.done) return;
        const ops = ['+', '-', '×'];
        const op = ops[Math.floor(Math.random() * 3)];
        const a = Math.floor(Math.random() * 9) + 1;
        const b = Math.floor(Math.random() * 9) + 1;
        let answer;
        if (op === '+') answer = a + b;
        else if (op === '-') answer = a - b;
        else answer = a * b;

        this.questionText.setText(`${a} ${op} ${b} = ?`);
        this.progressText.setText(`${this.correct} / ${this.total}`);

        // Generate 4 choices with answer included
        const choices = new Set([answer]);
        while (choices.size < 4) {
            choices.add(answer + Math.floor(Math.random() * 11) - 5);
        }
        const shuffled = [...choices].sort(() => Math.random() - 0.5);

        // Clear old buttons
        this.buttons.forEach(b => b.destroy());
        this.buttons = [];

        const cx = this.scale.width / 2;
        shuffled.forEach((val, i) => {
            const x = cx + (i % 2 === 0 ? -80 : 80);
            const y = 420 + Math.floor(i / 2) * 100;
            const btn = this.add.text(x, y, `${val}`, {
                fontSize: '28px', color: '#1a1a2e', backgroundColor: '#e94560',
                padding: { x: 30, y: 15 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => this.answer(val, answer));
            this.buttons.push(btn);
        });
    }

    answer(picked, correct) {
        if (this.done) return;
        if (picked === correct) {
            this.correct++;
            this.feedbackText.setText('✓').setColor('#4ecca3');
        } else {
            this.feedbackText.setText('✗').setColor('#e94560');
        }
        this.time.delayedCall(200, () => { this.feedbackText.setText(''); });

        if (this.correct >= this.total) {
            this.progressText.setText(`${this.correct} / ${this.total}`);
            this.win();
        } else {
            this.showQuestion();
        }
    }

    update() {
        if (this.done) return;
        const elapsed = (this.time.now - this.startTime) / 1000;
        const remaining = Math.max(0, this.timeLimit - elapsed);
        this.timerText.setText(`⏱ ${remaining.toFixed(1)}s`);
        if (remaining <= 0) {
            this.done = true;
            this.showFailModal(`⏰ Time's up! Got ${this.correct}/${this.total}`);
        }
    }

    showFailModal(msg) {
        const cx = this.scale.width / 2;
        this.buttons.forEach(b => b.destroy());
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(20).setStrokeStyle(2, 0xe94560);
        this.add.text(cx, 380, msg, { fontSize: '18px', color: '#e94560' }).setOrigin(0.5).setDepth(21);
        this.add.text(cx, 430, '[ Retry ]', {
            fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 480, '[ Back ]', {
            fontSize: '18px', color: '#888'
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        const cx = this.scale.width / 2;
        this.questionText.setText('🧠 Done!');
        this.buttons.forEach(b => b.destroy());
        this.add.text(cx, 650, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
