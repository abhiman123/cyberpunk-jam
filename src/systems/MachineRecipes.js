const RECIPES = [
    {
        id: 'basic_motor',
        spriteKey: 'machine_motor',
        label: 'Basic Motor',
        parts: [
            { id: 'wire_red',  tool: 'wire',   label: 'Red Wire',   slotX: 20, slotY: -10 },
            { id: 'wire_blue', tool: 'wire',   label: 'Blue Wire',  slotX: 20, slotY: 10  },
            { id: 'bolt_main', tool: 'hammer', label: 'Bolt',       slotX: 60, slotY: 0   },
        ],
        gearReward: 5,
        unlockedFromStart: true,
    },
    {
        id: 'gear_assembly',
        spriteKey: 'machine_gear',
        label: 'Gear Assembly',
        parts: [
            { id: 'gear_a',   tool: 'wrench', label: 'Gear A',  slotX: 10, slotY: -20 },
            { id: 'gear_b',   tool: 'wrench', label: 'Gear B',  slotX: 10, slotY: 20  },
            { id: 'wire_pwr', tool: 'wire',   label: 'Power Wire', slotX: 50, slotY: 0 },
            { id: 'bolt_x2',  tool: 'hammer', label: 'Bolts',   slotX: 80, slotY: 0   },
        ],
        gearReward: 10,
        unlockedFromStart: false,   // unlocked after 20 gears collected
        unlockCost: 20,
    },
    {
        id: 'coolant_pump',
        spriteKey: 'machine_pump',
        label: 'Coolant Pump',
        parts: [
            { id: 'pipe_a',   tool: 'wrench', label: 'Pipe A',   slotX: 15, slotY: -15 },
            { id: 'pipe_b',   tool: 'wrench', label: 'Pipe B',   slotX: 15, slotY: 15  },
            { id: 'seal',     tool: 'hammer', label: 'Seal',     slotX: 45, slotY: 0   },
            { id: 'wire_gnd', tool: 'wire',   label: 'Ground',   slotX: 70, slotY: -10 },
            { id: 'wire_sig', tool: 'wire',   label: 'Signal',   slotX: 70, slotY: 10  },
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
            { id: 'lens',     tool: 'wrench', label: 'Lens',     slotX: 10, slotY: 0   },
            { id: 'circuit',  tool: 'solder', label: 'Circuit',  slotX: 40, slotY: -10 },
            { id: 'wire_a',   tool: 'wire',   label: 'Wire A',   slotX: 40, slotY: 10  },
            { id: 'wire_b',   tool: 'wire',   label: 'Wire B',   slotX: 60, slotY: 10  },
            { id: 'bolt_frm', tool: 'hammer', label: 'Frame',    slotX: 80, slotY: 0   },
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
        // call this whenever gears are collected
        // returns the newly unlocked recipe, or null
        for (const recipe of RECIPES) {
            if (!unlockedIds.has(recipe.id) && totalGears >= recipe.unlockCost) {
                unlockedIds.add(recipe.id);
                return recipe;   // caller can show a "NEW MACHINE UNLOCKED" notice
            }
        }
        return null;
    },

    getById(id) {
        return RECIPES.find(r => r.id === id);
    },
};

export default MachineRecipes;