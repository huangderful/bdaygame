const config = {
    type: Phaser.AUTO,
    width: 390,
    height: 844,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    scene: [TitleScene, LevelSelectScene, ArchiveScene, SettingsScene, MiniGame, MiniGameDig, MiniGameDraw, MiniGameMath, MiniGamePatience],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);

// Android back button support via browser history
window.addEventListener('popstate', () => {
    const current = game.scene.getScenes(true)[0];
    if (!current || current.scene.key === 'Title') {
        // Already at title, let Android handle it (exit app)
        return;
    }
    if (current.scene.key === 'LevelSelect' || current.scene.key === 'Archive' || current.scene.key === 'Settings') {
        current.scene.start('Title');
    } else {
        // In a minigame — go back to level select
        current.scene.start('LevelSelect');
    }
});

// Push history state on every scene start so back button has something to pop
game.events.on('ready', () => {
    game.scene.getScenes(false).forEach(scene => {
        scene.events.on('create', () => {
            if (scene.scene.key !== 'Title') {
                history.pushState({ scene: scene.scene.key }, '');
            }
        });
    });
});

const DEFAULT_LEVELS = [
    { name: 'DIG', completed: false, pageText: 'You dug deep and found what was buried. Some treasures take effort to uncover.' },
    { name: 'DRAW', completed: false, pageText: 'Your hand traced what your mind imagined. Shape by shape, you proved precision lives in you.' },
    { name: 'MATH', completed: false, pageText: 'Numbers bent to your will. 15 answers in 15 seconds — your mind is sharper than you think.' },
    { name: 'PATIENCE', completed: false, pageText: 'You stood still when the world moved. 30 seconds of chaos, and you found the calm within.' }
];

game.events.on('ready', () => {
    const saved = localStorage.getItem('bdaygame_levels');
    if (saved) {
        const parsed = JSON.parse(saved);
        const namesMatch = parsed.length === DEFAULT_LEVELS.length &&
            parsed.every((l, i) => l.name === DEFAULT_LEVELS[i].name);
        if (!namesMatch) {
            game.registry.set('levels', JSON.parse(JSON.stringify(DEFAULT_LEVELS)));
            localStorage.removeItem('bdaygame_levels');
        } else {
            game.registry.set('levels', parsed);
        }
    } else {
        game.registry.set('levels', JSON.parse(JSON.stringify(DEFAULT_LEVELS)));
    }
});
