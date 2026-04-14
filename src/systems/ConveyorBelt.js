export default class ConveyorBelt {
    constructor(scene) {
        this.scene = scene;
        this.speed = 60;          // pixels per second, increase over time
        this.activeMachine = null;
        this.queue = [];

        // callbacks — set these from GameScene
        this.onMachineArrived = null;
        this.onMachineCompleted = null;
        this.onMachineLeft = null;

        this.spawnZone = { x: 900 };   // machines enter from the right
        this.workZone  = { x: 400 };   // where the player interacts
        this.exitZone  = { x: -100 };  // machine leaves screen left

        this._spawnNext();
    }

    _spawnNext() {
        const recipe = MachineRecipes.getRandom();
        const machine = {
            recipe,
            sprite: this.scene.add.image(this.spawnZone.x, 360, recipe.spriteKey),
            completedParts: new Set(),
            arrived: false,
            failed: false,
        };
        this.queue.push(machine);
    }

    update(delta) {
        const dt = delta / 1000;  // convert ms to seconds

        for (const machine of this.queue) {
            if (machine.failed) continue;

            machine.sprite.x -= this.speed * dt;

            // machine reaches the work zone
            if (!machine.arrived && machine.sprite.x <= this.workZone.x) {
                machine.arrived = true;
                this.activeMachine = machine;
                this.onMachineArrived?.(machine);
            }

            // machine leaves without being completed
            if (machine.sprite.x <= this.exitZone.x) {
                if (!this._isMachineComplete(machine)) {
                    machine.failed = true;
                    this.onMachineLeft?.(machine);
                }
                this._cleanup(machine);
                this._spawnNext();
            }
        }

        // remove cleaned up machines
        this.queue = this.queue.filter(m => !m._done);
    }

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
        if (this.activeMachine === machine) this.activeMachine = null;
    }

    increaseSpeed(amount) {
        this.speed += amount;
    }
}