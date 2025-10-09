#!/usr/bin/env node

/**
 * Scenario Generator CLI
 *
 * Creates a new scenario with all necessary files:
 * - Scenario JavaScript file
 * - Test file
 * - Documentation
 *
 * Usage:
 *   node scripts/create-scenario.js my-awesome-scenario
 *   npm run create:scenario my-awesome-scenario
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function toPascalCase(str) {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

async function promptForDetails(scenarioName) {
  console.log('\n📝 Scenario Generator\n');
  console.log(`Creating scenario: ${scenarioName}\n`);

  const description = await question('Description (brief): ');
  const author = await question('Author name (optional): ');

  const features = [];
  console.log('\nFeatures (press Enter with empty line to finish):');
  while (true) {
    const feature = await question(`  - `);
    if (!feature) break;
    features.push(feature);
  }

  const needsPhysics = (await question('\nUse physics (Ammo.js)? (y/N): ')).toLowerCase() === 'y';
  const needsParticles = (await question('Use particles? (y/N): ')).toLowerCase() === 'y';
  const needsHooks = (await question('Use hooks? (y/N): ')).toLowerCase() === 'y';
  const needsLighting = (await question('Custom lighting? (y/N): ')).toLowerCase() === 'y';
  const needsRoom = (await question('Load room/environment? (y/N): ')).toLowerCase() === 'y';

  return {
    description: description || 'A new Amica scenario',
    author: author || 'Anonymous',
    features: features.length > 0 ? features : ['Custom behavior'],
    needsPhysics,
    needsParticles,
    needsHooks,
    needsLighting,
    needsRoom,
  };
}

function generateScenarioCode(scenarioName, details) {
  const className = toPascalCase(scenarioName);
  const { description, author, features, needsPhysics, needsParticles, needsHooks, needsLighting, needsRoom } = details;

  let code = `class Scenario {
  /*
   * Description: ${description}
   * Version: 1.0
   * Author: ${author}
   * Created: ${getCurrentDate()}
   *
   * Features:
${features.map(f => `   * - ${f}`).join('\n')}
   */

  constructor(ctx) {
    console.log('[${className}] Initializing...');

    // Core references
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;
${needsHooks ? '    this.hookManager = ctx.hookManager;\n' : ''}
    // State variables
    this.timer = 0;
${needsPhysics ? '    this.rigidBodies = [];\n    this.tmpTrans = null;\n' : ''}${needsLighting ? '    this.lights = [];\n' : ''}${needsParticles ? '    this.particleTimer = 0;\n    this.particleInterval = 0.1;\n' : ''}${needsHooks ? '    this.hookIds = [];\n' : ''}  }

  async setup() {
    console.log('[${className}] Running setup...');

    // Load VRM model
    await this.$.loadVrm(
      this.config('vrm_url'),
      (progress) => console.log(\`[${className}] Loading VRM: \${progress}\`)
    );
`;

  if (needsRoom) {
    code += `
    // Load room/environment
    await this.$.loadRoom(
      '/room/your-room.glb',
      new this.THREE.Vector3(0, 0, 0),
      new this.THREE.Euler(0, 0, 0),
      new this.THREE.Vector3(1, 1, 1),
      (progress) => console.log(\`[${className}] Loading room: \${progress}\`)
    );
`;
  }

  code += `
    // Setup camera
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);
`;

  if (needsLighting) {
    code += `
    // Setup lighting
    const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.5);
    this.$.addLight(ambientLight);
    this.lights.push(ambientLight);

    const dirLight = new this.THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    this.$.addLight(dirLight);
    this.lights.push(dirLight);
`;
  }

  if (needsPhysics) {
    code += `
    // Setup physics
    const Ammo = this.$.ammo;
    if (Ammo) {
      this.tmpTrans = new Ammo.btTransform();
      // Add physics setup here
    }
`;
  }

  if (needsHooks) {
    code += `
    // Register hooks
    if (this.hookManager) {
      const hookId = this.hookManager.register(
        'before:llm:request',
        (context) => {
          console.log('[${className}] LLM request intercepted');
          return context;
        }
      );
      this.hookIds.push(hookId);
    }
`;
  }

  code += `
    console.log('[${className}] Setup complete!');
  }

  update(delta) {
    this.timer += delta;

    // Your update logic here
${needsParticles ? `
    // Particle spawning
    this.particleTimer += delta;
    if (this.particleTimer >= this.particleInterval) {
      this.createParticle();
      this.particleTimer = 0;
    }
` : ''}${needsPhysics ? `
    // Update physics
    this.updatePhysics();
` : ''}  }
`;

  if (needsParticles) {
    code += `
  createParticle() {
    const position = new this.THREE.Vector3(0, 1, 0);
    const velocity = new this.THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2,
      (Math.random() - 0.5) * 2
    );
    const color = new this.THREE.Color(Math.random() * 0xffffff);

    this.$.createParticle({
      position,
      velocity,
      color,
      size: 0.05,
      lifetime: 2.0
    });
  }
`;
  }

  if (needsPhysics) {
    code += `
  updatePhysics() {
    const Ammo = this.$.ammo;
    if (!Ammo) return;

    for (let i = 0; i < this.rigidBodies.length; i++) {
      const mesh = this.rigidBodies[i];
      const body = mesh.userData.physicsBody;

      if (!body) continue;

      const ms = body.getMotionState();
      if (ms) {
        ms.getWorldTransform(this.tmpTrans);
        const p = this.tmpTrans.getOrigin();
        const q = this.tmpTrans.getRotation();
        mesh.position.set(p.x(), p.y(), p.z());
        mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
      }
    }
  }
`;
  }

  code += `
  async cleanup() {
    console.log('[${className}] Cleaning up...');
`;

  if (needsLighting) {
    code += `
    // Remove lights
    this.lights.forEach(light => {
      this.$.removeLight(light);
    });
    this.lights = [];
`;
  }

  if (needsPhysics) {
    code += `
    // Remove physics bodies
    this.rigidBodies.forEach(mesh => {
      this.$.scene.remove(mesh);
      if (mesh.userData.physicsBody) {
        this.$.physicsWorld.removeRigidBody(mesh.userData.physicsBody);
      }
    });
    this.rigidBodies = [];
`;
  }

  if (needsHooks) {
    code += `
    // Unregister hooks
    if (this.hookManager) {
      this.hookIds.forEach(id => {
        this.hookManager.unregister(id);
      });
    }
`;
  }

  code += `
    console.log('[${className}] Cleanup complete');
  }
}
`;

  return code;
}

function generateTestCode(scenarioName, details) {
  const className = toPascalCase(scenarioName);
  const { needsPhysics, needsParticles, needsLighting } = details;

  return `import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScenarioTestRunner,
  ScenarioAssertions,
  ScenarioTestUtils,
} from '@/testing/ScenarioTestRunner';
import fs from 'fs';
import path from 'path';

// Load scenario code from file
const scenarioPath = path.join(__dirname, '../../public/scenarios/${scenarioName}.js');
const scenarioCode = fs.readFileSync(scenarioPath, 'utf-8');

describe('${className} Scenario', () => {
  let runner: ScenarioTestRunner;
  let ${className}Scenario: any;

  beforeEach(() => {
    ${className}Scenario = ScenarioTestUtils.loadScenarioFromCode(scenarioCode);
    runner = new ScenarioTestRunner(${className}Scenario);
  });

  describe('setup', () => {
    it('should load VRM model', async () => {
      await runner.setup();
      ScenarioAssertions.assertVrmLoaded(runner);
    });

    it('should position camera correctly', async () => {
      await runner.setup();
      ScenarioAssertions.assertCameraPosition(runner, { x: 0, y: 1.5, z: 4 });
    });
${needsLighting ? `
    it('should create lights', async () => {
      await runner.setup();
      ScenarioAssertions.assertLightCount(runner, 2); // Ambient + Directional
    });
` : ''}  });

  describe('update logic', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should run update without errors', () => {
      expect(() => {
        runner.update(0.016);
      }).not.toThrow();
    });

    it('should update timer', () => {
      const scenario = runner.getScenario();
      const initialTimer = scenario.timer;

      runner.updateForDuration(1.0);

      expect(scenario.timer).toBeGreaterThan(initialTimer);
      expect(scenario.timer).toBeCloseTo(1.0, 1);
    });
${needsParticles ? `
    it('should create particles periodically', () => {
      runner.updateForDuration(1.0);
      ScenarioAssertions.assertParticleCreated(runner, 5);
    });
` : ''}${needsPhysics ? `
    it('should update physics', () => {
      const scenario = runner.getScenario();

      expect(() => {
        scenario.updatePhysics();
      }).not.toThrow();
    });
` : ''}  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should cleanup without errors', async () => {
      await expect(runner.cleanup()).resolves.not.toThrow();
    });
${needsLighting || needsPhysics ? `
    it('should remove all resources', async () => {
      runner.updateForDuration(2.0);

      await ScenarioAssertions.assertCleanup(runner, {
${needsLighting ? '        lightsRemoved: true,\n' : ''}${needsPhysics ? '        physicsObjectsRemoved: true,\n' : ''}      });
    });
` : ''}  });

  describe('performance', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should run efficiently', () => {
      const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);

      expect(perf.avgMs).toBeLessThan(1);
      expect(perf.maxMs).toBeLessThan(5);
    });
  });
});
`;
}

function generateReadme(scenarioName, details) {
  const { description, features } = details;

  return `# ${toPascalCase(scenarioName)} Scenario

## Description

${description}

## Features

${features.map(f => `- ${f}`).join('\n')}

## Usage

### Configuration

Add to your config file:

\`\`\`toml
scenario_url = "/scenarios/${scenarioName}.js"
\`\`\`

### Testing

Run tests:

\`\`\`bash
npm test -- scenarios/${scenarioName}
\`\`\`

## Customization

Edit \`public/scenarios/${scenarioName}.js\` to customize behavior.

## API Reference

See [SCENARIO_SYSTEM.md](../../SCENARIO_SYSTEM.md) for full API documentation.

---

Created: ${getCurrentDate()}
`;
}

async function createScenario(scenarioName) {
  const kebabName = toKebabCase(scenarioName);

  // Paths
  const scenarioPath = path.join(__dirname, '../public/scenarios', `${kebabName}.js`);
  const testPath = path.join(__dirname, '../__tests__/scenarios', `${kebabName}.scenario.spec.ts`);
  const readmePath = path.join(__dirname, '../public/scenarios', `${kebabName}.README.md`);

  // Check if scenario already exists
  if (fs.existsSync(scenarioPath)) {
    console.error(`❌ Error: Scenario "${kebabName}" already exists!`);
    process.exit(1);
  }

  // Prompt for details
  const details = await promptForDetails(kebabName);

  // Generate files
  console.log('\n⚙️  Generating files...\n');

  const scenarioCode = generateScenarioCode(kebabName, details);
  const testCode = generateTestCode(kebabName, details);
  const readme = generateReadme(kebabName, details);

  // Write files
  fs.writeFileSync(scenarioPath, scenarioCode);
  console.log(`✅ Created: ${scenarioPath}`);

  fs.writeFileSync(testPath, testCode);
  console.log(`✅ Created: ${testPath}`);

  fs.writeFileSync(readmePath, readme);
  console.log(`✅ Created: ${readmePath}`);

  // Success message
  console.log('\n🎉 Scenario created successfully!\n');
  console.log('Next steps:');
  console.log(`  1. Edit your scenario: public/scenarios/${kebabName}.js`);
  console.log(`  2. Run tests: npm test -- scenarios/${kebabName}`);
  console.log(`  3. Use in config: scenario_url = "/scenarios/${kebabName}.js"`);
  console.log('');
}

// Main
(async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/create-scenario.js <scenario-name>');
    console.error('Example: node scripts/create-scenario.js my-awesome-scenario');
    process.exit(1);
  }

  const scenarioName = args[0];

  try {
    await createScenario(scenarioName);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
})();
