import MachineRecipes from '../data/MachineRecipes.js';

export default class ConveyorBelt {
    constructor(scene) {
        this.scene = scene;
        this.speed = 60;        // pixels per second — increases over time
        this.queue = [];
        this.activeMachine = null;

        // callbacks — set these from GameScene
        this.onMachineArrived   = null;
        this.onMachineCompleted = null;
        this.onMachineLeft      = null;

        this.spawnZone = { x: 1350 };   // machines enter from the right
        this.workZone  = { x: 500  };   // where the player interacts
        this.exitZone  = { x: -150 };   // machine leaves the screen left

        this.beltY = 380;

        this._buildVisual();
        this._spawnNext();
    }

    // ─── VISUAL ─────────────────────────────────────────────────────────────

    _buildVisual() {
        this.beltTiles = [];
        const tileW = 40;
        const count = Math.ceil(1280 / tileW) + 2;

        for (let i = 0; i < count; i++) {
            const tile = this.scene.add.image(i * tileW, this.beltY + 60, 'conveyor_tile')
                .setDepth(1);
            this.beltTiles.push(tile);
        }
    }

    _scrollBelt(dt) {
        const scrollSpeed = this.speed * dt;
        for (const tile of this.beltTiles) {
            tile.x -= scrollSpeed;
            if (tile.x < -40) {
                tile.x += this.beltTiles.length * 40;
            }
        }
    }

    // ─── SPAWNING ────────────────────────────────────────────────────────────

    _spawnNext() {
        const recipe = MachineRecipes.getRandom();
        const sprite = this.scene.add.image(this.spawnZone.x, this.beltY, recipe.spriteKey)
            .setDepth(5);

        const machine = {
            recipe,
            sprite,
            completedParts: new Set(),
            arrived: false,
            failed: false,
            _done: false,
        };

        this.queue.push(machine);
    }

    // ─── UPDATE ──────────────────────────────────────────────────────────────

    update(delta) {
        const dt = delta / 1000;

        this._scrollBelt(dt);

        for (const machine of this.queue) {
            if (machine._done) continue;

            machine.sprite.x -= this.speed * dt;

            // machine reaches the work zone
            if (!machine.arrived && machine.sprite.x <= this.workZone.x) {
                machine.arrived = true;
                this.activeMachine = machine;
                this.onMachineArrived?.(machine);
            }

            // machine leaves the screen without being completed
            if (machine.sprite.x <= this.exitZone.x) {
                if (!this._isMachineComplete(machine) && !machine.failed) {
                    machine.failed = true;
                    this.onMachineLeft?.(machine);
                }
                this._cleanup(machine);
                this._spawnNext();
            }
        }

        // purge done machines
        this.queue = this.queue.filter(m => !m._done);
    }

    // ─── COMPLETION ──────────────────────────────────────────────────────────

    completePart(machine, partId) {
        machine.completedParts.add(partId);
        if (this._isMachineComplete(machine)) {
            this.onMachineCompleted?.(machine);
            this._cleanup(machine);
            this._spawnNext();
        }
    }

    _isMachineComplete(machine) {
        return machine.recipe.parts.every(p => machine.completedParts.has(p.id));
    }

    _cleanup(machine) {
        machine.sprite.destroy();
        machine._done = true;
        if (this.activeMachine === machine) {
            this.activeMachine = null;
        }
    }

    // ─── DIFFICULTY ──────────────────────────────────────────────────────────

    increaseSpeed(amount) {
        this.speed = Math.min(this.speed + amount, 200); // cap at 200
    }
}
