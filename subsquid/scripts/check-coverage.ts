#!/usr/bin/env ts-node
/**
 * Comprehensive Event Coverage Check
 * Compares ABI events with processor configuration and handlers
 */

import * as fs from 'fs'
import * as path from 'path'

// Dynamically require the compiled ABIs
const factoryAbi = require('../lib/abi/PersonaTokenFactory')
const amicaAbi = require('../lib/abi/AmicaTokenMainnet')
const bridgeAbi = require('../lib/abi/AmicaBridgeWrapper')

const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
}

function log(color: keyof typeof COLORS, message: string): void {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

// Admin/system events we don't usually track
const SKIP_EVENTS = new Set([
  'Initialized', 'OwnershipTransferred', 'Paused', 'Unpaused',
  'Approval', 'ApprovalForAll'
])

// Load processor and main files
const processorContent = fs.readFileSync(path.join(__dirname, '../src/processor.ts'), 'utf8')
const mainContent = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8')

interface EventCoverage {
  contract: string
  event: string
  inProcessor: boolean
  hasHandler: boolean
  isSkipped: boolean
}

function checkContract(
  contractName: string,
  events: Record<string, any>,
  abiPrefix: string
): EventCoverage[] {
  const coverage: EventCoverage[] = []

  for (const eventName of Object.keys(events)) {
    const inProcessor = processorContent.includes(`${abiPrefix}.events.${eventName}.topic`)
    const hasHandler = mainContent.includes(`case ${abiPrefix}.events.${eventName}.topic:`)
    const isSkipped = SKIP_EVENTS.has(eventName)

    coverage.push({
      contract: contractName,
      event: eventName,
      inProcessor,
      hasHandler,
      isSkipped
    })
  }

  return coverage.sort((a, b) => a.event.localeCompare(b.event))
}

console.log('\n' + '='.repeat(80))
log('blue', '📊 EVENT COVERAGE ANALYSIS')
console.log('='.repeat(80) + '\n')

// Check all contracts
const allCoverage = [
  ...checkContract('PersonaTokenFactory', factoryAbi.events, 'factoryAbi'),
  ...checkContract('AmicaTokenMainnet', amicaAbi.events, 'amicaAbi'),
  ...checkContract('AmicaBridgeWrapper', bridgeAbi.events, 'bridgeAbi')
]

// Group by contract
const byContract = allCoverage.reduce((acc, item) => {
  if (!acc[item.contract]) acc[item.contract] = []
  acc[item.contract].push(item)
  return acc
}, {} as Record<string, EventCoverage[]>)

// Display results
for (const [contract, events] of Object.entries(byContract)) {
  log('blue', `\n${contract}`)
  console.log('─'.repeat(80))

  for (const { event, inProcessor, hasHandler, isSkipped } of events) {
    if (inProcessor && hasHandler) {
      log('green', `  ✅ ${event.padEnd(30)} - Fully tracked`)
    } else if (isSkipped) {
      log('yellow', `  ⊘  ${event.padEnd(30)} - Skipped (admin/system event)`)
    } else if (inProcessor && !hasHandler) {
      log('red', `  ❌ ${event.padEnd(30)} - IN PROCESSOR BUT NO HANDLER!`)
    } else if (!inProcessor && hasHandler) {
      log('red', `  ❌ ${event.padEnd(30)} - HAS HANDLER BUT NOT IN PROCESSOR!`)
    } else {
      log('red', `  ❌ ${event.padEnd(30)} - NOT TRACKED`)
    }
  }

  const tracked = events.filter(e => e.inProcessor && e.hasHandler).length
  const skipped = events.filter(e => e.isSkipped).length
  const missing = events.filter(e => !e.inProcessor && !e.hasHandler && !e.isSkipped).length

  console.log(`\n  Summary: ${tracked} tracked, ${missing} missing, ${skipped} skipped\n`)
}

// Overall summary
console.log('='.repeat(80))
log('blue', '📈 OVERALL SUMMARY')
console.log('─'.repeat(80))

const totalEvents = allCoverage.length
const totalTracked = allCoverage.filter(e => e.inProcessor && e.hasHandler).length
const totalSkipped = allCoverage.filter(e => e.isSkipped).length
const totalMissing = allCoverage.filter(e => !e.inProcessor && !e.hasHandler && !e.isSkipped).length
const errors = allCoverage.filter(e =>
  (e.inProcessor && !e.hasHandler) || (!e.inProcessor && e.hasHandler)
).length

console.log()
log('green', `✅ Tracked Events:     ${totalTracked}/${totalEvents - totalSkipped}`)
log('red', `❌ Missing Events:     ${totalMissing}/${totalEvents - totalSkipped}`)
log('yellow', `⊘  Skipped Events:     ${totalSkipped}/${totalEvents}`)
if (errors > 0) {
  log('red', `⚠️  Configuration Errors: ${errors}`)
}
console.log()

// List missing business events
const missingBusinessEvents = allCoverage.filter(e => !e.inProcessor && !e.hasHandler && !e.isSkipped)
if (missingBusinessEvents.length > 0) {
  console.log('='.repeat(80))
  log('red', '⚠️  MISSING BUSINESS EVENTS')
  console.log('─'.repeat(80))
  missingBusinessEvents.forEach(({ contract, event }) => {
    console.log(`  ${contract}.${event}`)
  })
  console.log()
}

// List configuration errors
const configErrors = allCoverage.filter(e =>
  (e.inProcessor && !e.hasHandler) || (!e.inProcessor && e.hasHandler)
)
if (configErrors.length > 0) {
  console.log('='.repeat(80))
  log('red', '🔧 CONFIGURATION ERRORS (FIX THESE!)')
  console.log('─'.repeat(80))
  configErrors.forEach(({ contract, event, inProcessor, hasHandler }) => {
    if (inProcessor && !hasHandler) {
      log('red', `  ${contract}.${event}: Event in processor.ts but no handler in main.ts`)
    } else {
      log('red', `  ${contract}.${event}: Handler in main.ts but not in processor.ts`)
    }
  })
  console.log()
}

console.log('='.repeat(80))

if (totalMissing === 0 && errors === 0) {
  log('green', '✅ SUCCESS: All business events are properly tracked!')
  process.exit(0)
} else if (errors > 0) {
  log('red', '❌ FAIL: Configuration errors found')
  process.exit(1)
} else {
  log('yellow', '⚠️  WARNING: Some business events are not tracked')
  process.exit(0)
}
