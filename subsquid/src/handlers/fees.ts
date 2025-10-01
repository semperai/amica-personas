import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { FeeConfig, UserSnapshot } from '../model'

// DEPRECATED: These events have been removed from the new contract
// FeeReductionConfigUpdated - fee reduction moved to separate contract
// TradingFeeConfigUpdated - removed
// SnapshotUpdated - removed

// Keeping this file for reference but all handlers are commented out
// You may want to delete this file entirely if you're sure these events won't be needed

/*
export async function handleFeeReductionConfigUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  // DEPRECATED - event no longer exists
}

export async function handleTradingFeeConfigUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  // DEPRECATED - event no longer exists
}

export async function handleSnapshotUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  // DEPRECATED - event no longer exists
}
*/
