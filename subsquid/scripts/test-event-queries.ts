/**
 * Test Event Queries
 *
 * Tests that all event types are being indexed correctly by querying
 * the database for sample data from each entity type.
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'amica_indexer',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
});

const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
  cyan: '\x1b[96m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

const eventTests = [
  {
    name: 'PersonaCreated Events',
    table: 'persona',
    query: 'SELECT COUNT(*) as count, MIN(created_at) as first_event, MAX(created_at) as last_event, COUNT(CASE WHEN domain IS NOT NULL THEN 1 END) as with_domain FROM persona',
    details: 'SELECT id, token_id, name, symbol, creator, domain, pool_id, graduation_timestamp FROM persona ORDER BY created_at DESC LIMIT 3',
  },
  {
    name: 'TokensPurchased/Sold Events (Trades)',
    table: 'trade',
    query: 'SELECT COUNT(*) as count, COUNT(CASE WHEN is_buy THEN 1 END) as buys, COUNT(CASE WHEN NOT is_buy THEN 1 END) as sells, SUM(amount_in) as total_volume FROM trade',
    details: 'SELECT id, trader, amount_in, amount_out, is_buy, timestamp FROM trade ORDER BY timestamp DESC LIMIT 3',
  },
  {
    name: 'AgentTokensDeposited Events',
    table: 'agent_deposit',
    query: 'SELECT COUNT(*) as count, SUM(amount) as total_deposited, COUNT(CASE WHEN withdrawn THEN 1 END) as withdrawn_count FROM agent_deposit',
    details: 'SELECT id, user, amount, withdrawn, rewards_claimed FROM agent_deposit ORDER BY timestamp DESC LIMIT 3',
  },
  {
    name: 'AgentRewardsDistributed Events',
    table: 'agent_reward',
    query: 'SELECT COUNT(*) as count, SUM(persona_tokens_received) as total_distributed FROM agent_reward',
    details: 'SELECT id, user, persona_tokens_received, timestamp FROM agent_reward ORDER BY timestamp DESC LIMIT 3',
  },
  {
    name: 'V4PoolCreated Events (Graduations)',
    table: 'persona',
    query: 'SELECT COUNT(*) as count, COUNT(CASE WHEN pool_id IS NOT NULL THEN 1 END) as with_pool_id, COUNT(CASE WHEN graduation_timestamp IS NOT NULL THEN 1 END) as graduated FROM persona WHERE pair_created = true',
    details: 'SELECT id, name, symbol, pair_created, pool_id, graduation_timestamp, pair_address FROM persona WHERE pair_created = true ORDER BY created_at DESC LIMIT 3',
  },
  {
    name: 'TokensClaimed Events (Post-Graduation)',
    table: 'token_withdrawal',
    query: 'SELECT COUNT(*) as count, SUM(amount) as total_claimed FROM token_withdrawal',
    details: 'SELECT id, user, amount, timestamp FROM token_withdrawal ORDER BY timestamp DESC LIMIT 3',
  },
  {
    name: 'MetadataUpdated Events',
    table: 'persona_metadata',
    query: 'SELECT COUNT(*) as count, COUNT(DISTINCT persona_id) as personas_with_metadata FROM persona_metadata',
    details: 'SELECT id, key, value, updated_at FROM persona_metadata ORDER BY updated_at DESC LIMIT 3',
  },
  {
    name: 'NFT Transfer Events',
    table: 'persona_transfer',
    query: 'SELECT COUNT(*) as count, COUNT(DISTINCT "from") as unique_senders, COUNT(DISTINCT "to") as unique_receivers FROM persona_transfer',
    details: 'SELECT id, "from", "to", timestamp FROM persona_transfer ORDER BY timestamp DESC LIMIT 3',
  },
  {
    name: 'Staking Pool Events',
    table: 'staking_pool',
    query: 'SELECT COUNT(*) as count, SUM(total_staked) as total_staked_all_pools, COUNT(CASE WHEN is_active THEN 1 END) as active_pools FROM staking_pool',
    details: 'SELECT id, pool_id, lp_token, total_staked, is_active FROM staking_pool ORDER BY total_staked DESC LIMIT 3',
  },
  {
    name: 'User Staking Events',
    table: 'user_stake',
    query: 'SELECT COUNT(*) as count, SUM(flexible_amount) as total_flexible, SUM(locked_amount) as total_locked FROM user_stake',
    details: 'SELECT id, user, flexible_amount, locked_amount, unclaimed_rewards FROM user_stake ORDER BY (flexible_amount + locked_amount) DESC LIMIT 3',
  },
  {
    name: 'Staking Lock Events',
    table: 'stake_lock',
    query: 'SELECT COUNT(*) as count, COUNT(CASE WHEN is_withdrawn THEN 1 END) as withdrawn, COUNT(CASE WHEN NOT is_withdrawn THEN 1 END) as active FROM stake_lock',
    details: 'SELECT id, amount, unlock_time, is_withdrawn FROM stake_lock ORDER BY created_at DESC LIMIT 3',
  },
  {
    name: 'Rewards Claimed Events',
    table: 'staking_reward_claim',
    query: 'SELECT COUNT(*) as count, SUM(total_amount) as total_claimed, COUNT(DISTINCT user) as unique_claimers FROM staking_reward_claim',
    details: 'SELECT id, user, total_amount, timestamp FROM staking_reward_claim ORDER BY timestamp DESC LIMIT 3',
  },
  {
    name: 'Bridge Wrap/Unwrap Events',
    table: 'bridge_activity',
    query: 'SELECT COUNT(*) as count, SUM(CASE WHEN action = \'WRAP\' THEN amount ELSE 0 END) as total_wrapped, SUM(CASE WHEN action = \'UNWRAP\' THEN amount ELSE 0 END) as total_unwrapped FROM bridge_activity',
    details: 'SELECT id, user, action, amount, timestamp FROM bridge_activity ORDER BY timestamp DESC LIMIT 3',
  },
  {
    name: 'AMICA Token Transfers',
    table: 'amica_transfer',
    query: `SELECT
      COUNT(*) as count,
      SUM(value) as total_value,
      COUNT(CASE WHEN is_to_factory THEN 1 END) as to_factory,
      COUNT(CASE WHEN is_from_factory THEN 1 END) as from_factory,
      COUNT(CASE WHEN is_to_staking THEN 1 END) as to_staking,
      COUNT(CASE WHEN is_from_staking THEN 1 END) as from_staking
    FROM amica_transfer`,
    details: 'SELECT id, "from", "to", value, is_to_factory, is_from_factory FROM amica_transfer ORDER BY timestamp DESC LIMIT 3',
  },
  {
    name: 'AMICA Burn & Claim Events',
    table: 'amica_claim',
    query: 'SELECT COUNT(*) as count, SUM(amount_burned) as total_burned, SUM(amount_claimed) as total_claimed FROM amica_claim',
    details: 'SELECT id, user, claimed_token, amount_burned, amount_claimed FROM amica_claim ORDER BY timestamp DESC LIMIT 3',
  },
];

async function runTest(test) {
  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '${test.table}'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      log('yellow', `  ⚠ Table '${test.table}' does not exist (entity not in schema)`);
      return { status: 'skipped', reason: 'table_not_exists' };
    }

    // Run main query
    const result = await pool.query(test.query);
    const stats = result.rows[0];

    const count = parseInt(stats.count || 0);

    if (count === 0) {
      log('yellow', `  ⚠ No events found (this may be normal if events haven't occurred yet)`);
      return { status: 'empty', count: 0 };
    }

    // Log stats
    log('green', `  ✓ Found ${count} events`);
    Object.entries(stats).forEach(([key, value]) => {
      if (key !== 'count' && value !== null && value !== undefined) {
        log('cyan', `    ${key}: ${value}`);
      }
    });

    // Get sample details
    if (test.details) {
      const details = await pool.query(test.details);
      if (details.rows.length > 0) {
        log('blue', `    Recent events:`);
        details.rows.forEach((row, i) => {
          console.log(`      ${i + 1}. ${JSON.stringify(row, null, 2).split('\n').join('\n         ')}`);
        });
      }
    }

    return { status: 'success', count };

  } catch (error) {
    log('red', `  ✗ Error: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  log('blue', 'Event Indexing Test Suite');
  console.log('='.repeat(70) + '\n');

  const results = {
    success: 0,
    empty: 0,
    skipped: 0,
    error: 0,
  };

  for (const test of eventTests) {
    log('cyan', `\nTesting: ${test.name}`);
    console.log('─'.repeat(70));

    const result = await runTest(test);
    results[result.status]++;
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  log('blue', 'Test Summary');
  console.log('─'.repeat(70));

  log('green', `✓ Success: ${results.success}/${eventTests.length} event types have data`);
  log('yellow', `⚠ Empty: ${results.empty}/${eventTests.length} event types are being tracked but have no data yet`);
  log('yellow', `⊘ Skipped: ${results.skipped}/${eventTests.length} event types not in schema`);

  if (results.error > 0) {
    log('red', `✗ Errors: ${results.error}/${eventTests.length} event types had errors`);
  }

  console.log('\n' + '='.repeat(70));

  if (results.error > 0) {
    log('red', '⚠ Some tests failed. Check the errors above.');
    process.exit(1);
  } else if (results.success === 0 && results.empty === eventTests.length) {
    log('yellow', '\n⚠ No events indexed yet. This is normal if the indexer just started.');
    log('yellow', '  Wait a few minutes for the processor to index blocks.\n');
  } else {
    log('green', '\n✓ Event indexing is working correctly!\n');
  }

  await pool.end();
}

main().catch(err => {
  log('red', `\n✗ Fatal error: ${err.message}\n`);
  process.exit(1);
});
