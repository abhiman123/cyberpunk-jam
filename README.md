Cyberpunk Assembly Line
A high-stakes, cyberpunk-themed assembly line game built with Phaser 3 and Vite. As an operative on the factory floor, you must assemble complex machines under the watchful eye of a looming security robot. Fail to keep up, and the consequences will be terminal.

Gameplay
Assemble Machines: Click on glowing parts of a machine using the correct tool to complete it.

Manage Tools: Switch between Wire, Hammer, Wrench, and Solder using hotkeys [1-4] or clicking the HUD.

Earn Gears: Completing machines earns you Gears, which automatically unlock more complex recipes and new tools.

Survive the Watcher: Every mistake or missed machine causes the security robot to advance. Seven mistakes result in a System Failure.

Tech Stack
Engine: Phaser 3

Bundler: Vite

Language: JavaScript (ES6+ Modules)

Project Structure
Plaintext
├── data/
│   └── MachineRecipes.js    # Logic for machine parts, rewards, and unlocks
├── scenes/
│   ├── Boot.js              # Asset generation and preloading
│   ├── Game.js              # Core gameplay loop and HUD logic
│   └── GameOver.js          # Scoring and restart logic
├── systems/
│   ├── ConveyorBelt.js      # Machine spawning and movement logic
│   ├── RobotFSM.js          # Security robot state machine (threat levels)
│   └── ToolSystem.js        # Tool interaction and slot management
├── main.js                  # Game configuration and entry point
└── index.html               # Web entry point

Getting Started
- Prerequisites
  * Node.js (v18 or higher recommended)

npm or yarn

Installation
Clone the repository or download the source files.

Install dependencies:

Bash
npm install
Development
To run the game locally with hot-reloading:

Bash
npm run dev
The game will typically be available at http://localhost:5173.

Building for Production
To create a production-ready bundle:

Bash
npm run build

Credits
Developed as a Cyberpunk Game Jam entry.
