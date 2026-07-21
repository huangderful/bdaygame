const TRIVIA_QUESTIONS = [
  { q: "What military adjacent role did Richard consider?",
    answers: ["NUPOC", "ROTC", "DANTES", "OCS"] },
  { q: "Which graph structure did Richard spend significant time researching?",
    answers: ["Hypergraph", "B Tree", "Skip lists", "Directed Acyclic Graphs"] },
  { q: "Which credit card does Richard want next?",
    answers: ["Atmos Rewards Ascent Visa Signature", "Amex Gold", "Chase Sapphire Reserve", "Bilt Obsidian"] },
  { q: "Which company did Richard do a commercial for (L no Apple for u)?",
    answers: ["Herbalife", "T Mobile", "Google", "Samsung"] },
  { q: "Which of the following did Richard build for a stupid job application?",
    answers: ["Fridge ingredient detector", "Grocery price tracker", "Global Minecraft library plugin", "Spam detector"] },
  { q: "What did Richard create his freshman year of college and wanted to sell?",
    answers: ["Covid 19 auto health badge plugin", "Auto class sign up", "Zombie Apocalypse Minecraft plugin", "AWS cloud security plugin"] },
  { q: "Which company did Richard get flown out to SF for?",
    answers: ["Cleat Street", "Hey gen", "Elevate", "Kiro"] },
  { q: "Richard's least favorite race?",
    answers: ["Monaco GP, no overtaking", "Indian", "Mexican, they spam babies and take my tax dollars and jobs", "Japanese people, they raped my country"] },
  { q: "Richard died on what character what day due to lag, slammed the table, and caused you to be scared?",
    answers: ["His 30K fame warrior", "His 100K Pally", "His 50K Sorc", "His 25K Necro"] },
  { q: "Richard's favorite dish that Vanessa has made so far:",
    answers: ["The super peppercornned Mapo Tofu", "Lime chicken noodles", "Green beans", "The sandwich we ate when I was at Nintendo"] },
  { q: "The thing Richard cringes to most often (this month)? (Like the cause of the throw up noises, not necessarily the MOST cringe thing)",
    answers: ["That time he went to your house the first time", "The soccer game at work", "Telling a teacher he was gay in 9th grade to get out of detention", "Overexaggerating a basketball injury that Terrie caused Freshman year"] },
  { q: "Richard hates what?",
    answers: ["Squirrels", "Lotion", "Wifi routers", "Arrowhead water"] },
  { q: "Richard's favorite big adventure with webs?",
    answers: ["Disneyland", "SF zoo", "Camping", "Seattle Aquarium"] },
  { q: "Richard's favorite actor",
    answers: ["Christian Bale", "Jackie Chan", "Bruce Li", "Ryan Reynolds"] },
  { q: "Richard's favorite basketball player's number:",
    answers: ["3", "30", "23", "5"] },
  { q: "Richard's favorite artist (currently)?",
    answers: ["Orion", "BoyWUke", "Bruno Mars", "Jamiroquai"] },
  { q: "Richard referred to a song he wanted to show you that you could not google on the drive back from camping — what was it?",
    answers: ["Masked Dedede", "A Glacier Farts Eventually", "Team Galactic Entrance (Jazz variant)", "Theme from Amazing Digital Circus"] },
  { q: "Richard has NOT played which of the following games?",
    answers: ["Deltarune", "Pokemon Pearl", "Dredge", "Pacman"] },
  { q: "Richard's favorite Ror2 item (no equipments)?",
    answers: ["Gas", "Plimp", "Chance Doll", "Kjaro's Band"] },
  { q: "Richard's least favorite class at UCSB?",
    answers: ["CS 16 Introduction to Computer Science", "CS 174b Design and Implementation of Database Systems", "CS 280 Topics in Computer Graphics", "CS 254 Advanced Computer Architecture"] },
  { q: "Richard thinks his Mario Kart kart setup in terms of optimality for winning, where 5 is average:",
    answers: ["3/10", "10/10", "8/10", "5/10"] },
  { q: "Richard can't fathom how people like which fetish:",
    answers: ["Scat", "Nugget", "CBT", "He understands them all"] },
];

class MiniGameTrivia extends Phaser.Scene {
    constructor() { super('MiniGameTrivia'); }

    init(data) { this.levelIndex = data.levelIndex ?? 14; }

    preload() { FeedbackFX.preload(this); }

    create() {
        const cx = this.scale.width / 2;
        this.total = DevConfig.stages(TRIVIA_QUESTIONS.length); // 22 (capped in dev)
        this.timeLimit = DevConfig.time(122);                   // 2 minutes 2 seconds
        this.done = false;
        // Stamped on the first update() tick — this.time.now is stale inside
        // create() when all assets are cached (no loader frames), which made
        // the timer expire instantly. Does NOT reset on in-run restart.
        this.startTime = null;

        this.add.text(cx, 40, 'TRIVIA', { fontSize: '34px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(cx, 82, '', { fontSize: '18px', color: '#888' }).setOrigin(0.5);
        this.progressText = this.add.text(cx, 116, '', { fontSize: '16px', color: '#4ecca3' }).setOrigin(0.5);

        this.questionText = this.add.text(cx, 210, '', {
            fontSize: '20px', color: '#ffffff', align: 'center',
            wordWrap: { width: 350 }
        }).setOrigin(0.5);

        this.feedbackText = this.add.text(cx, 800, '', { fontSize: '18px' }).setOrigin(0.5);

        this.buttons = [];
        this.beginRun();
    }

    // Reshuffle question order (options reshuffled per-question in showQuestion) and start over.
    // Called at level start AND after a wrong answer — timer keeps running either way.
    beginRun() {
        if (this.done) return;
        this.order = Phaser.Utils.Array.Shuffle(TRIVIA_QUESTIONS.slice()).slice(0, this.total);
        this.currentIndex = 0;
        this.showQuestion();
    }

    showQuestion() {
        if (this.done) return;

        const item = this.order[this.currentIndex];
        this.correctAnswer = item.answers[0];
        const options = Phaser.Utils.Array.Shuffle(item.answers.slice());

        this.questionText.setText(item.q);
        this.progressText.setText(`Question ${this.currentIndex + 1} / ${this.total}`);

        // Clear old buttons
        this.buttons.forEach(b => b.destroy());
        this.buttons = [];

        const cx = this.scale.width / 2;
        let cursorY = 360;
        options.forEach((opt) => {
            const btn = this.add.text(cx, cursorY, opt, {
                fontSize: '16px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#16213e',
                align: 'center', padding: { x: 14, y: 10 },
                wordWrap: { width: 330 }
            }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

            cursorY += btn.height + 14;
            btn.on('pointerdown', (p) => this.answer(opt, p.x, p.y));
            this.buttons.push(btn);
        });
    }

    answer(picked, x, y) {
        if (this.done) return;

        const isCorrect = picked === this.correctAnswer;
        FeedbackFX.fountain(this, x, y, isCorrect);

        if (isCorrect) {
            FeedbackFX.playPositive(this);
            this.feedbackText.setText('✓').setColor('#4ecca3');
            this.currentIndex++;
            if (this.currentIndex >= this.total) {
                this.win();
            } else {
                this.showQuestion();
            }
        } else {
            FeedbackFX.playNegative(this);
            this.feedbackText.setText('✗ Starting over...').setColor('#e63030');
            bumpAttempts(this.levelIndex); // each wrong-answer restart counts as an attempt
            // Restart the WHOLE run (reshuffle) from question 1 — timer keeps running.
            this.beginRun();
        }
    }

    update() {
        if (this.done) return;
        if (this.startTime === null) this.startTime = this.time.now;
        const elapsed = (this.time.now - this.startTime) / 1000;
        const remaining = Math.max(0, this.timeLimit - elapsed);
        const m = Math.floor(remaining / 60);
        const s = Math.floor(remaining % 60);
        this.timerText.setText(`⏱ ${m}:${s.toString().padStart(2, '0')}`);
        if (remaining <= 0) {
            this.done = true;
            this.showFailModal("⏰ Time's up!");
        }
    }

    showFailModal(msg) {
        const cx = this.scale.width / 2;
        this.buttons.forEach(b => b.destroy());
        this.buttons = [];
        this.feedbackText.setText('');
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(20).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 380, msg, { fontSize: '18px', color: '#e63030' }).setOrigin(0.5).setDepth(21);
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
        this.buttons.forEach(b => b.destroy());
        this.buttons = [];
        this.questionText.setText(`🧠 All ${this.total} correct!`);
        this.progressText.setText(`Question ${this.total} / ${this.total}`);
        this.feedbackText.setText('');
        this.add.text(cx, 650, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
