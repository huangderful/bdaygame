const config = {
    type: Phaser.AUTO,
    width: 390,
    height: 844,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    scene: [TitleScene, LevelSelectScene, ArchiveScene, SettingsScene, MiniGame, MiniGameDig, MiniGameDraw, MiniGameMath, MiniGamePatience, MiniGameQuickdraw, MiniGameDodge, MiniGameEcho, MiniGameNeedle, MiniGameOrbit, MiniGameTangle, MiniGameFlood, MiniGameGravity, MiniGameArena, MiniGameSpinner, MiniGameMirror, MiniGameFog, MiniGameFuse, MiniGameSteady, MiniGameChain, MiniGameTaliyah],
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
    { name: 'PATIENCE', completed: false, pageText: 'You stood still when the world moved. 30 seconds of chaos, and you found the calm within.' },
    { name: 'QUICKDRAW', completed: false, pageText: 'Faster than thought. When the moment came, you were already there.' },
    { name: 'DODGE', completed: false, pageText: 'The sky fell and you danced through it. Not a scratch.' },
    { name: 'ECHO', completed: false, pageText: 'You heard the pattern in the noise. Memory is just attention, sustained.' },
    { name: 'NEEDLE', completed: false, pageText: 'Through the narrowest gap, you found your way. Patience and precision, together.' },
    { name: 'ORBIT', completed: false, pageText: 'The stars aligned because you waited for them. Timing is everything.' },
    { name: 'TANGLE', completed: false, pageText: 'What was knotted, you made straight. Every problem has a thread to pull.' },
    { name: 'FLOOD', completed: false, pageText: 'One color at a time, you painted the world. Strategy in simplicity.' },
    { name: 'GRAVITY', completed: false, pageText: 'Up became down and you kept going. Perspective is just a choice.' },
    { name: 'ARENA', completed: false, pageText: 'The walls closed in but you stayed free. Space is what you make of it.' },
    { name: 'SPINNER', completed: false, pageText: 'Four plates, two hands, one mind. You kept them all in the air.' },
    { name: 'MIRROR', completed: false, pageText: 'Left was right and right was wrong. You found truth in the reflection.' },
    { name: 'FOG', completed: false, pageText: 'Blind but not lost. You trusted your touch when your eyes failed.' },
    { name: 'FUSE', completed: false, pageText: 'A split second between boom and silence. You chose silence.' },
    { name: 'STEADY', completed: false, pageText: 'Your hand did not waver. The line held true from start to end.' },
    { name: 'CHAIN', completed: false, pageText: '20 links, unbroken. Your mind is a machine when it needs to be.' },
    { name: 'TALIYAH', completed: false, pageText: 'You surfed the wall, dodged the hooks, and found the treasure. GG.' },
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
