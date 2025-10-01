/**
 * Validation script to check if subsquid is indexing correctly
 *
 * This script connects to the database and performs various checks:
 * - Verifies data is being indexed
 * - Checks for recent blocks
 * - Validates entity counts
 * - Tests GraphQL server connectivity
 */

import pkg from 'pg';
const { Pool } = pkg;

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
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function checkTable(tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const count = parseInt(result.rows[0].count);

    if (count > 0) {
      log('green', `✓ ${tableName}: ${count} records`);
      return { success: true, count };
    } else {
      log('yellow', `⚠ ${tableName}: No records yet`);
      return { success: true, count: 0 };
    }
  } catch (error) {
    log('red', `✗ ${tableName}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function getLatestBlock() {
  try {
    // Check processor state
    const result = await pool.query(`
      SELECT height, timestamp
      FROM squid_processor.status
      ORDER BY id DESC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const { height, timestamp } = result.rows[0];
      const blockTime = new Date(parseInt(timestamp));
      const timeSinceBlock = Date.now() - blockTime.getTime();
      const minutesAgo = Math.floor(timeSinceBlock / 60000);

      log('blue', `\nLatest indexed block: ${height}`);
      log('blue', `Block timestamp: ${blockTime.toISOString()} (${minutesAgo} minutes ago)`);

      if (minutesAgo > 30) {
        log('yellow', '⚠ Warning: Indexer may be behind or not running');
      } else {
        log('green', '✓ Indexer appears to be running');
      }

      return { height, timestamp: blockTime };
    } else {
      log('yellow', '⚠ No processor status found - indexer may not have started yet');
      return null;
    }
  } catch (error) {
    log('red', `✗ Error checking processor status: ${error.message}`);
    return null;
  }
}

async function getRecentPersonas() {
  try {
    const result = await pool.query(`
      SELECT id, token_id, name, symbol, creator, created_at
      FROM persona
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (result.rows.length > 0) {
      log('blue', '\nRecent Personas:');
      result.rows.forEach(persona => {
        log('blue', `  - ${persona.name} (${persona.symbol}) - Token ID: ${persona.token_id}`);
      });
    }

    return result.rows;
  } catch (error) {
    log('red', `✗ Error fetching personas: ${error.message}`);
    return [];
  }
}

async function checkGlobalStats() {
  try {
    const result = await pool.query(`
      SELECT
        total_personas,
        total_trades,
        total_buy_trades,
        total_sell_trades,
        total_volume,
        last_updated
      FROM global_stats
      WHERE id = 'global'
    `);

    if (result.rows.length > 0) {
      const stats = result.rows[0];
      log('blue', '\nGlobal Statistics:');
      log('blue', `  Total Personas: ${stats.total_personas}`);
      log('blue', `  Total Trades: ${stats.total_trades} (${stats.total_buy_trades} buys, ${stats.total_sell_trades} sells)`);
      log('blue', `  Total Volume: ${stats.total_volume}`);
      log('blue', `  Last Updated: ${stats.last_updated}`);
    } else {
      log('yellow', '⚠ No global stats found yet');
    }

    return result.rows[0] || null;
  } catch (error) {
    log('yellow', `⚠ Global stats not available: ${error.message}`);
    return null;
  }
}

async function testGraphQLServer() {
  try {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ __schema { queryType { name } } }'
      })
    });

    if (response.ok) {
      log('green', '✓ GraphQL server is responding on port 4000');
      return true;
    } else {
      log('yellow', '⚠ GraphQL server returned error status');
      return false;
    }
  } catch (error) {
    log('yellow', '⚠ GraphQL server not accessible - it may not be running');
    log('yellow', `  Start it with: npm run serve`);
    return false;
  }
}

async function main() {
  console.log('\n=================================');
  log('blue', 'Amica Subsquid Indexer Validation');
  console.log('=================================\n');

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    log('green', '✓ Database connection successful\n');

    // Check processor status
    log('blue', '1. Checking processor status...');
    await getLatestBlock();

    // Check main tables
    log('blue', '\n2. Checking entity counts...');
    await checkTable('persona');
    await checkTable('trade');
    await checkTable('agent_deposit');
    await checkTable('staking_pool');
    await checkTable('user_stake');
    await checkTable('bridge_activity');

    // Get recent data
    log('blue', '\n3. Checking recent data...');
    await getRecentPersonas();
    await checkGlobalStats();

    // Test GraphQL
    log('blue', '\n4. Testing GraphQL server...');
    await testGraphQLServer();

    log('green', '\n=================================');
    log('green', 'Validation complete!');
    log('green', '=================================\n');

  } catch (error) {
    log('red', `\n✗ Fatal error: ${error.message}\n`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
