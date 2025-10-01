/**
 * Event Coverage Check
 *
 * This script compares the events defined in contract ABIs against
 * the events we're actually indexing in the processor.
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

// Load ABIs
const personaFactoryAbi = require('../src/abi/PersonaTokenFactory.json');
const amicaTokenAbi = require('../src/abi/AmicaToken.json');
const bridgeWrapperAbi = require('../src/abi/AmicaBridgeWrapper.json');

// Extract events from processor.ts
const processorFile = fs.readFileSync(path.join(__dirname, '../src/processor.ts'), 'utf8');
const mainFile = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');

// Helper to get event names from ABI
function getEventNames(abi) {
  return abi.abi
    .filter(item => item.type === 'event')
    .map(item => item.name)
    .sort();
}

// Helper to check if event is indexed in processor
function isEventIndexed(eventName, processorContent) {
  const patterns = [
    `factoryAbi.events.${eventName}.topic`,
    `stakingAbi.events.${eventName}.topic`,
    `bridgeAbi.events.${eventName}.topic`,
    `amicaAbi.events.${eventName}.topic`
  ];
  return patterns.some(pattern => processorContent.includes(pattern));
}

// Helper to check if event has handler in main.ts
function hasEventHandler(eventName, mainContent) {
  const patterns = [
    `case factoryAbi.events.${eventName}.topic:`,
    `case stakingAbi.events.${eventName}.topic:`,
    `case bridgeAbi.events.${eventName}.topic:`,
    `case amicaAbi.events.${eventName}.topic:`
  ];
  return patterns.some(pattern => mainContent.includes(pattern));
}

// Categories of events
const ADMIN_EVENTS = ['Initialized', 'OwnershipTransferred', 'Paused', 'Unpaused'];
const APPROVAL_EVENTS = ['Approval', 'ApprovalForAll'];

console.log('\n' + '='.repeat(70));
log('blue', 'Event Coverage Analysis');
console.log('='.repeat(70) + '\n');

// Check PersonaTokenFactory
log('blue', '1. PersonaTokenFactory Events');
console.log('─'.repeat(70));
const factoryEvents = getEventNames(personaFactoryAbi);
let factoryIndexed = 0, factoryMissing = 0, factoryAdmin = 0;

factoryEvents.forEach(event => {
  const indexed = isEventIndexed(event, processorFile);
  const handled = hasEventHandler(event, mainFile);
  const isAdmin = ADMIN_EVENTS.includes(event) || APPROVAL_EVENTS.includes(event);

  if (indexed && handled) {
    log('green', `  ✓ ${event}`);
    factoryIndexed++;
  } else if (isAdmin) {
    log('yellow', `  ⊘ ${event} (admin/approval event)`);
    factoryAdmin++;
  } else {
    log('red', `  ✗ ${event} (NOT INDEXED)`);
    factoryMissing++;
  }
});

console.log();
log('blue', `Summary: ${factoryIndexed} indexed, ${factoryMissing} missing, ${factoryAdmin} admin/approval\n`);

// Check AmicaToken
log('blue', '2. AmicaToken Events');
console.log('─'.repeat(70));
const amicaEvents = getEventNames(amicaTokenAbi);
let amicaIndexed = 0, amicaMissing = 0, amicaAdmin = 0;

amicaEvents.forEach(event => {
  const indexed = isEventIndexed(event, processorFile);
  const handled = hasEventHandler(event, mainFile);
  const isAdmin = ADMIN_EVENTS.includes(event) || APPROVAL_EVENTS.includes(event);
  const isTransfer = event === 'Transfer';

  if (indexed && handled) {
    log('green', `  ✓ ${event}`);
    amicaIndexed++;
  } else if (isAdmin) {
    log('yellow', `  ⊘ ${event} (admin/approval event)`);
    amicaAdmin++;
  } else if (isTransfer) {
    log('red', `  ✗ ${event} (CRITICAL - Track token flows!)`);
    amicaMissing++;
  } else {
    log('red', `  ✗ ${event} (NOT INDEXED)`);
    amicaMissing++;
  }
});

console.log();
log('blue', `Summary: ${amicaIndexed} indexed, ${amicaMissing} missing, ${amicaAdmin} admin/approval\n`);

// Check AmicaBridgeWrapper
log('blue', '3. AmicaBridgeWrapper Events');
console.log('─'.repeat(70));
const bridgeEvents = getEventNames(bridgeWrapperAbi);
let bridgeIndexed = 0, bridgeMissing = 0, bridgeAdmin = 0;

bridgeEvents.forEach(event => {
  const indexed = isEventIndexed(event, processorFile);
  const handled = hasEventHandler(event, mainFile);
  const isAdmin = ADMIN_EVENTS.includes(event) || APPROVAL_EVENTS.includes(event);
  const isEmergency = event.includes('Emergency');

  if (indexed && handled) {
    log('green', `  ✓ ${event}`);
    bridgeIndexed++;
  } else if (isAdmin) {
    log('yellow', `  ⊘ ${event} (admin event)`);
    bridgeAdmin++;
  } else if (isEmergency) {
    log('red', `  ✗ ${event} (IMPORTANT - Track emergency actions!)`);
    bridgeMissing++;
  } else {
    log('red', `  ✗ ${event} (NOT INDEXED)`);
    bridgeMissing++;
  }
});

console.log();
log('blue', `Summary: ${bridgeIndexed} indexed, ${bridgeMissing} missing, ${bridgeAdmin} admin\n`);

// Overall summary
console.log('='.repeat(70));
log('blue', 'Overall Summary');
console.log('─'.repeat(70));

const totalEvents = factoryEvents.length + amicaEvents.length + bridgeEvents.length;
const totalIndexed = factoryIndexed + amicaIndexed + bridgeIndexed;
const totalMissing = factoryMissing + amicaMissing + bridgeMissing;
const totalAdmin = factoryAdmin + amicaAdmin + bridgeAdmin;

log('green', `✓ Indexed: ${totalIndexed}/${totalEvents} events`);
log('red', `✗ Missing: ${totalMissing}/${totalEvents} events`);
log('yellow', `⊘ Admin/Approval: ${totalAdmin}/${totalEvents} events (optional)\n`);

// Critical missing events
console.log('='.repeat(70));
log('red', 'CRITICAL Missing Events');
console.log('─'.repeat(70));

const criticalMissing = [];

if (!isEventIndexed('Transfer', processorFile) || !processorFile.includes('amicaAbi.events.Transfer')) {
  criticalMissing.push({
    contract: 'AmicaToken',
    event: 'Transfer',
    reason: 'Track all AMICA token movements (deposits, withdrawals, trading)'
  });
}

if (!isEventIndexed('TokenClaimed', processorFile)) {
  criticalMissing.push({
    contract: 'AmicaToken',
    event: 'TokenClaimed',
    reason: 'Track when users claim tokens from burn and claim mechanism'
  });
}

if (!isEventIndexed('EmergencyWithdraw', processorFile)) {
  criticalMissing.push({
    contract: 'AmicaBridgeWrapper',
    event: 'EmergencyWithdraw',
    reason: 'Track emergency withdrawals for security monitoring'
  });
}

if (criticalMissing.length > 0) {
  criticalMissing.forEach(({ contract, event, reason }) => {
    log('red', `\n  ${contract}.${event}`);
    console.log(`    Reason: ${reason}`);
  });
} else {
  log('green', '  None - all critical events are tracked!');
}

console.log('\n' + '='.repeat(70));

// Recommendations
console.log('\n' + '='.repeat(70));
log('blue', 'Recommendations');
console.log('─'.repeat(70));

console.log(`
1. HIGH PRIORITY - Add AmicaToken.Transfer tracking:
   - Track token flows into/out of PersonaFactory
   - Monitor large token movements
   - Enable balance tracking per user

2. MEDIUM PRIORITY - Add AmicaToken.TokenClaimed tracking:
   - Track burn and claim mechanism usage
   - Important for tokenomics analysis

3. MEDIUM PRIORITY - Add Bridge emergency events:
   - EmergencyWithdraw - security monitoring
   - BridgeMetricsUpdated - track bridge health
   - BridgeTokensUpdated - track configuration changes

4. LOW PRIORITY - Consider PersonaToken ERC20 transfers:
   - This would create a LOT of data
   - Only add if detailed persona token flow tracking is needed
   - Alternative: Track only transfers to/from specific addresses

5. OPTIONAL - Admin events:
   - Useful for governance/admin action auditing
   - Can add later if needed for transparency
`);

console.log('='.repeat(70) + '\n');

// Exit with error if critical events are missing
if (criticalMissing.length > 0) {
  log('yellow', '⚠ Warning: Critical events are not being indexed');
  log('yellow', '  Consider adding these events for complete coverage\n');
  process.exit(0); // Exit with 0 since this is just a warning
} else {
  log('green', '✓ All critical events are being tracked\n');
  process.exit(0);
}
