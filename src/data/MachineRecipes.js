const RECIPES = [
    {
        id: 'basic_motor',
        spriteKey: 'machine_motor',
        label: 'Basic Motor',
        parts: [
            { id: 'wire_red',  tool: 'wire',   label: 'Red Wire',  slotX: -40, slotY: -10 },
            { id: 'wire_blue', tool: 'wire',   label: 'Blue Wire', slotX: -40, slotY: 10  },
            { id: 'bolt_main', tool: 'hammer', label: 'Bolt',      slotX: 20,  slotY: 0   },
        ],
        gearReward: 5,
        unlockedFromStart: true,
    },
    {
        id: 'gear_assembly',
        spriteKey: 'machine_gear',
        label: 'Gear Assembly',
        parts: [
            { id: 'gear_a',   tool: 'wrench', label: 'Gear A',     slotX: -40, slotY: -20 },
            { id: 'gear_b',   tool: 'wrench', label: 'Gear B',     slotX: -40, slotY: 20  },
            { id: 'wire_pwr', tool: 'wire',   label: 'Power Wire', slotX: 10,  slotY: 0   },
            { id: 'bolt_x2',  tool: 'hammer', label: 'Bolts',      slotX: 40,  slotY: 0   },
        ],
        gearReward: 10,
        unlockedFromStart: false,
        unlockCost: 20,
    },
    {
        id: 'coolant_pump',
        spriteKey: 'machine_pump',
        label: 'Coolant Pump',
        parts: [
            { id: 'pipe_a',   tool: 'wrench', label: 'Pipe A',  slotX: -45, slotY: -15 },
            { id: 'pipe_b',   tool: 'wrench', label: 'Pipe B',  slotX: -45, slotY: 15  },
            { id: 'seal',     tool: 'hammer', label: 'Seal',    slotX: 5,   slotY: 0   },
            { id: 'wire_gnd', tool: 'wire',   label: 'Ground',  slotX: 30,  slotY: -10 },
            { id: 'wire_sig', tool: 'wire',   label: 'Signal',  slotX: 30,  slotY: 10  },
        ],
        gearReward: 18,
        unlockedFromStart: false,
        unlockCost: 50,
    },
    {
        id: 'sensor_array',
        spriteKey: 'machine_sensor',
        label: 'Sensor Array',
        parts: [
            { id: 'lens',     tool: 'wrench', label: 'Lens',    slotX: -50, slotY: 0   },
            { id: 'circuit',  tool: 'solder', label: 'Circuit', slotX: -10, slotY: -10 },
            { id: 'wire_a',   tool: 'wire',   label: 'Wire A',  slotX: -10, slotY: 10  },
            { id: 'wire_b',   tool: 'wire',   label: 'Wire B',  slotX: 20,  slotY: 10  },
            { id: 'bolt_frm', tool: 'hammer', label: 'Frame',   slotX: 40,  slotY: 0   },
        ],
        gearReward: 25,
        unlockedFromStart: false,
        unlockCost: 80,
    },
];

// tracks which recipes are currently available
let unlockedIds = new Set(
    RECIPES.filter(r => r.unlockedFromStart).map(r => r.id)
);

const MachineRecipes = {
    getUnlocked() {
        return RECIPES.filter(r => unlockedIds.has(r.id));
    },

    getRandom() {
        const pool = this.getUnlocked();
        return pool[Math.floor(Math.random() * pool.length)];
    },

    tryUnlock(totalGears) {
        // returns the newly unlocked recipe, or null
        for (const recipe of RECIPES) {
            if (!unlockedIds.has(recipe.id) && recipe.unlockCost !== undefined && totalGears >= recipe.unlockCost) {
                unlockedIds.add(recipe.id);
                return recipe;
            }
        }
        return null;
    },

    getById(id) {
        return RECIPES.find(r => r.id === id);
    },

    reset() {
        // call this when restarting the game
        unlockedIds = new Set(
            RECIPES.filter(r => r.unlockedFromStart).map(r => r.id)
        );
    },
};

export default MachineRecipes;
