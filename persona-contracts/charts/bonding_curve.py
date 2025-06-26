import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec

# Constants from the contract
PRECISION = 10**18
CURVE_MULTIPLIER = 33
SELL_FEE_BPS = 10
BPS_DIVISOR = 10000

def get_virtual_reserves(reserve_sold, reserve_total):
    """Calculate virtual reserves based on tokens sold"""
    # Using the contract's approximation: b = T * 1000 / 4745
    virtual_buffer = (reserve_total * 1000) // 4745

    # Virtual token reserve decreases as tokens are sold
    virtual_token = reserve_total - reserve_sold + virtual_buffer

    # Calculate k from initial state
    initial_reserve = reserve_total + virtual_buffer
    k = initial_reserve * initial_reserve

    # Maintain constant k
    virtual_eth = k // virtual_token

    return virtual_token, virtual_eth

def get_current_price(reserve_sold, reserve_total):
    """Get current price at a given reserve level"""
    virtual_token, virtual_eth = get_virtual_reserves(reserve_sold, reserve_total)
    # Price = virtualETH / virtualToken (with 18 decimal precision)
    price = (virtual_eth * PRECISION) // virtual_token
    return price / PRECISION  # Convert back to regular units

def calculate_cost_between(from_tokens, to_tokens, total_supply):
    """Calculate the exact cost between two points on the curve"""
    if from_tokens >= to_tokens:
        return 0

    # Get virtual ETH at the starting and ending points
    _, virtual_eth_start = get_virtual_reserves(from_tokens, total_supply)
    _, virtual_eth_end = get_virtual_reserves(to_tokens, total_supply)

    # The cost is the difference in virtual ETH reserves
    cost = virtual_eth_end - virtual_eth_start
    return cost

def calculate_amount_out_for_sell(amount_in, reserve_sold, reserve_total):
    """Calculate ETH output for selling tokens (with fee)"""
    # Current state
    virtual_token, virtual_eth = get_virtual_reserves(reserve_sold, reserve_total)

    # After selling, virtual token reserve increases
    new_virtual_token = virtual_token + amount_in

    # Calculate new virtual ETH to maintain constant k
    k = virtual_token * virtual_eth
    new_virtual_eth = k // new_virtual_token

    # ETH output is the difference
    eth_before_fee = virtual_eth - new_virtual_eth

    # Apply fee
    fee = (eth_before_fee * SELL_FEE_BPS) // BPS_DIVISOR
    return eth_before_fee - fee

# Set up the bonding curve parameters
total_supply = 1_000_000  # 1M tokens for example
tokens_sold = np.linspace(0, total_supply, 1000)

# Calculate prices, costs, and market caps
prices = [get_current_price(sold, total_supply) for sold in tokens_sold]
cumulative_costs = [calculate_cost_between(0, sold, total_supply) for sold in tokens_sold]
market_caps = [price * total_supply for price in prices]

# Create figure with subplots
fig = plt.figure(figsize=(15, 10))
gs = GridSpec(2, 2, figure=fig, hspace=0.3, wspace=0.3)

# 1. Price Chart
ax1 = fig.add_subplot(gs[0, 0])
ax1.plot(tokens_sold/1000, prices, 'b-', linewidth=2)
ax1.set_xlabel('Tokens Sold (thousands)')
ax1.set_ylabel('Price per Token')
ax1.set_title('Token Price vs Tokens Sold')
ax1.grid(True, alpha=0.3)
ax1.axhline(y=prices[0], color='g', linestyle='--', alpha=0.5, label=f'Start Price: {prices[0]:.4f}')
ax1.axhline(y=prices[-1], color='r', linestyle='--', alpha=0.5, label=f'End Price: {prices[-1]:.4f}')
ax1.legend()

# Add price multiplier annotation
multiplier = prices[-1] / prices[0]
ax1.text(0.05, 0.95, f'Price Multiplier: {multiplier:.1f}x',
         transform=ax1.transAxes, verticalalignment='top',
         bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

# 2. Market Cap Chart
ax2 = fig.add_subplot(gs[0, 1])
ax2.plot(tokens_sold/1000, [mc/1000 for mc in market_caps], 'g-', linewidth=2)
ax2.set_xlabel('Tokens Sold (thousands)')
ax2.set_ylabel('Market Cap (thousands)')
ax2.set_title('Market Cap vs Tokens Sold')
ax2.grid(True, alpha=0.3)

# 3. Cumulative ETH Raised
ax3 = fig.add_subplot(gs[1, 0])
ax3.plot(tokens_sold/1000, cumulative_costs, 'r-', linewidth=2)
ax3.fill_between(tokens_sold/1000, 0, cumulative_costs, alpha=0.3, color='red')
ax3.set_xlabel('Tokens Sold (thousands)')
ax3.set_ylabel('Cumulative ETH Raised')
ax3.set_title('Total ETH Raised vs Tokens Sold')
ax3.grid(True, alpha=0.3)

# Add total ETH raised annotation
total_eth = cumulative_costs[-1]
ax3.text(0.95, 0.05, f'Total ETH: {total_eth:.2f}',
         transform=ax3.transAxes, horizontalalignment='right',
         bbox=dict(boxstyle='round', facecolor='lightcoral', alpha=0.5))

# 4. Buy vs Sell Price Comparison
ax4 = fig.add_subplot(gs[1, 1])
sell_prices = []
for i, sold in enumerate(tokens_sold[1:], 1):  # Skip 0 as you can't sell when nothing is sold
    if sold > 0:
        # Calculate sell price for 1 token
        eth_out = calculate_amount_out_for_sell(1, sold, total_supply)
        sell_price = eth_out
        sell_prices.append(sell_price)
    else:
        sell_prices.append(0)

ax4.plot(tokens_sold[1:]/1000, prices[1:], 'b-', linewidth=2, label='Buy Price')
ax4.plot(tokens_sold[1:]/1000, sell_prices, 'r--', linewidth=2, label='Sell Price (after fee)')
ax4.set_xlabel('Tokens Sold (thousands)')
ax4.set_ylabel('Price per Token')
ax4.set_title('Buy vs Sell Price (0.1% sell fee)')
ax4.grid(True, alpha=0.3)
ax4.legend()

# Calculate and display spread
spread_pct = [(buy - sell) / buy * 100 if buy > 0 else 0
              for buy, sell in zip(prices[1:], sell_prices)]
avg_spread = np.mean(spread_pct)
ax4.text(0.05, 0.95, f'Avg Spread: {avg_spread:.2f}%',
         transform=ax4.transAxes, verticalalignment='top',
         bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.5))

# Main title
fig.suptitle('Bonding Curve with Virtual Reserves (33x Multiplier)', fontsize=16, fontweight='bold')

# Add explanation text
explanation = ("This bonding curve uses virtual reserves to achieve a 33x price multiplier from start to finish.\n"
               "The virtual buffer is calculated as T * 1000 / 4745 to maintain the constant product formula x * y = k")
fig.text(0.5, 0.02, explanation, ha='center', fontsize=10, style='italic')

plt.tight_layout()
plt.show()

# Print some key statistics
print("Bonding Curve Statistics:")
print(f"Total Supply: {total_supply:,} tokens")
print(f"Starting Price: {prices[0]:.6f}")
print(f"Ending Price: {prices[-1]:.6f}")
print(f"Price Multiplier: {prices[-1]/prices[0]:.1f}x")
print(f"Total ETH Raised: {total_eth:.2f}")
print(f"Final Market Cap: {market_caps[-1]:,.2f}")
print(f"Average Buy/Sell Spread: {avg_spread:.2f}%")
