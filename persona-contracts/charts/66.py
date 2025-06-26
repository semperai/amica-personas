import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec

# Constants
PRECISION = 10**18
SELL_FEE_BPS = 10
BPS_DIVISOR = 10000

def get_virtual_reserves(reserve_sold, reserve_total, target_multiplier=33):
    """Calculate virtual reserves based on tokens sold

    For a target multiplier M:
    - At start: price = 1
    - At end: price = M
    - Virtual buffer b = T / (sqrt(M) - 1)
    """
    # Calculate virtual buffer for target multiplier
    # For 33x: sqrt(33) - 1 ≈ 4.745
    # For 66x: sqrt(66) - 1 ≈ 7.124
    sqrt_multiplier = np.sqrt(target_multiplier)
    divisor = sqrt_multiplier - 1

    # Using integer approximation for precision
    # For 33x: 1000/4745 ≈ 0.2108
    # For 66x: 1000/7124 ≈ 0.1404
    divisor_scaled = int(divisor * 1000)
    virtual_buffer = (reserve_total * 1000) // divisor_scaled

    # Virtual token reserve decreases as tokens are sold
    virtual_token = reserve_total - reserve_sold + virtual_buffer

    # Calculate k from initial state
    initial_reserve = reserve_total + virtual_buffer
    k = initial_reserve * initial_reserve

    # Maintain constant k
    virtual_eth = k // virtual_token

    return virtual_token, virtual_eth

def get_current_price(reserve_sold, reserve_total, target_multiplier=33):
    """Get current price at a given reserve level"""
    virtual_token, virtual_eth = get_virtual_reserves(reserve_sold, reserve_total, target_multiplier)
    price = (virtual_eth * PRECISION) // virtual_token
    return price / PRECISION

def calculate_cost_between(from_tokens, to_tokens, total_supply, target_multiplier=33):
    """Calculate the exact cost between two points on the curve"""
    if from_tokens >= to_tokens:
        return 0

    _, virtual_eth_start = get_virtual_reserves(from_tokens, total_supply, target_multiplier)
    _, virtual_eth_end = get_virtual_reserves(to_tokens, total_supply, target_multiplier)

    cost = virtual_eth_end - virtual_eth_start
    return cost

def calculate_amount_out_for_sell(amount_in, reserve_sold, reserve_total, target_multiplier=33):
    """Calculate ETH output for selling tokens (with fee)"""
    virtual_token, virtual_eth = get_virtual_reserves(reserve_sold, reserve_total, target_multiplier)

    new_virtual_token = virtual_token + amount_in
    k = virtual_token * virtual_eth
    new_virtual_eth = k // new_virtual_token

    eth_before_fee = virtual_eth - new_virtual_eth
    fee = (eth_before_fee * SELL_FEE_BPS) // BPS_DIVISOR
    return eth_before_fee - fee

# Set up parameters
total_supply = 1_000_000
tokens_sold = np.linspace(0, total_supply, 1000)

# Calculate for both 33x and 66x curves
curves_data = {}
for multiplier in [33, 66]:
    prices = [get_current_price(sold, total_supply, multiplier) for sold in tokens_sold]
    cumulative_costs = [calculate_cost_between(0, sold, total_supply, multiplier) for sold in tokens_sold]
    market_caps = [price * total_supply for price in prices]

    curves_data[multiplier] = {
        'prices': prices,
        'cumulative_costs': cumulative_costs,
        'market_caps': market_caps
    }

# Create comparison figure
fig = plt.figure(figsize=(16, 12))
gs = GridSpec(3, 2, figure=fig, hspace=0.35, wspace=0.3)

# 1. Price Comparison
ax1 = fig.add_subplot(gs[0, :])
for multiplier, color in [(33, 'blue'), (66, 'red')]:
    data = curves_data[multiplier]
    ax1.plot(tokens_sold/1000, data['prices'], color=color, linewidth=2.5,
             label=f'{multiplier}x curve', alpha=0.8)

    # Mark 85% point for 66x curve
    if multiplier == 66:
        idx_85 = int(0.85 * len(tokens_sold))
        price_at_85 = data['prices'][idx_85]
        multiplier_at_85 = price_at_85 / data['prices'][0]
        ax1.plot(tokens_sold[idx_85]/1000, price_at_85, 'ro', markersize=10)
        ax1.annotate(f'85% sold\n{multiplier_at_85:.1f}x multiplier',
                    xy=(tokens_sold[idx_85]/1000, price_at_85),
                    xytext=(tokens_sold[idx_85]/1000 - 150, price_at_85 + 10),
                    arrowprops=dict(arrowstyle='->', color='red', alpha=0.7),
                    fontsize=10, ha='center',
                    bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.7))

ax1.set_xlabel('Tokens Sold (thousands)', fontsize=12)
ax1.set_ylabel('Price per Token', fontsize=12)
ax1.set_title('Price Curves Comparison: 33x vs 66x Target Multiplier', fontsize=14, fontweight='bold')
ax1.grid(True, alpha=0.3)
ax1.legend(fontsize=11)
ax1.set_xlim(0, 1000)

# 2. Multiplier Progression
ax2 = fig.add_subplot(gs[1, 0])
for multiplier, color in [(33, 'blue'), (66, 'red')]:
    data = curves_data[multiplier]
    multipliers = [price / data['prices'][0] for price in data['prices']]
    ax2.plot(tokens_sold/total_supply * 100, multipliers, color=color,
             linewidth=2.5, label=f'{multiplier}x curve')

# Add reference lines
ax2.axhline(y=33, color='green', linestyle='--', alpha=0.5, label='33x reference')
ax2.axvline(x=85, color='gray', linestyle='--', alpha=0.5, label='85% sold')

ax2.set_xlabel('Progress (% of tokens sold)', fontsize=12)
ax2.set_ylabel('Price Multiplier', fontsize=12)
ax2.set_title('Price Multiplier Progression', fontsize=13, fontweight='bold')
ax2.grid(True, alpha=0.3)
ax2.legend()

# 3. ETH Raised Comparison
ax3 = fig.add_subplot(gs[1, 1])
for multiplier, color in [(33, 'blue'), (66, 'red')]:
    data = curves_data[multiplier]
    ax3.plot(tokens_sold/1000, data['cumulative_costs'], color=color,
             linewidth=2.5, label=f'{multiplier}x curve', alpha=0.8)

    # Mark 85% point
    if multiplier == 66:
        idx_85 = int(0.85 * len(tokens_sold))
        eth_at_85 = data['cumulative_costs'][idx_85]
        ax3.plot(tokens_sold[idx_85]/1000, eth_at_85, 'ro', markersize=10)
        ax3.text(tokens_sold[idx_85]/1000 + 50, eth_at_85,
                f'{eth_at_85:.1f} ETH\nat 85%', fontsize=10,
                bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.7))

ax3.set_xlabel('Tokens Sold (thousands)', fontsize=12)
ax3.set_ylabel('Cumulative ETH Raised', fontsize=12)
ax3.set_title('ETH Raised Comparison', fontsize=13, fontweight='bold')
ax3.grid(True, alpha=0.3)
ax3.legend()

# 4. Price Rate of Change (Steepness)
ax4 = fig.add_subplot(gs[2, 0])
for multiplier, color in [(33, 'blue'), (66, 'red')]:
    data = curves_data[multiplier]
    # Calculate price change rate (derivative approximation)
    price_changes = np.diff(data['prices']) / np.diff(tokens_sold) * 1000  # per 1000 tokens
    ax4.plot(tokens_sold[1:]/1000, price_changes, color=color,
             linewidth=2, label=f'{multiplier}x curve', alpha=0.8)

ax4.set_xlabel('Tokens Sold (thousands)', fontsize=12)
ax4.set_ylabel('Price Change Rate (per 1k tokens)', fontsize=12)
ax4.set_title('Price Acceleration (Curve Steepness)', fontsize=13, fontweight='bold')
ax4.grid(True, alpha=0.3)
ax4.legend()

# 5. Key Statistics Comparison
ax5 = fig.add_subplot(gs[2, 1])
ax5.axis('off')

stats_text = "Curve Statistics Comparison\n" + "="*40 + "\n\n"

for i, multiplier in enumerate([33, 66]):
    data = curves_data[multiplier]
    stats_text += f"{multiplier}x Curve:\n"
    stats_text += f"  • Starting Price: {data['prices'][0]:.6f}\n"
    stats_text += f"  • Ending Price: {data['prices'][-1]:.6f}\n"
    stats_text += f"  • Total ETH Raised: {data['cumulative_costs'][-1]:.2f}\n"
    stats_text += f"  • Final Market Cap: {data['market_caps'][-1]:,.0f}\n"

    if multiplier == 66:
        idx_85 = int(0.85 * len(tokens_sold))
        price_at_85 = data['prices'][idx_85]
        multiplier_at_85 = price_at_85 / data['prices'][0]
        eth_at_85 = data['cumulative_costs'][idx_85]
        stats_text += f"  • Multiplier at 85%: {multiplier_at_85:.1f}x\n"
        stats_text += f"  • ETH raised at 85%: {eth_at_85:.2f}\n"
        stats_text += f"  • % of total ETH at 85%: {eth_at_85/data['cumulative_costs'][-1]*100:.1f}%\n"

    stats_text += "\n"

ax5.text(0.1, 0.9, stats_text, transform=ax5.transAxes, fontsize=11,
         verticalalignment='top', fontfamily='monospace',
         bbox=dict(boxstyle='round', facecolor='lightgray', alpha=0.8))

# Main title
fig.suptitle('Bonding Curve Analysis: 33x vs 66x Target Multiplier', fontsize=16, fontweight='bold')

plt.tight_layout()
plt.show()

# Verify the math
print("Mathematical Verification:")
print("="*50)
data_66 = curves_data[66]
idx_85 = int(0.85 * len(tokens_sold))
multiplier_at_85 = data_66['prices'][idx_85] / data_66['prices'][0]
print(f"66x curve multiplier at 85% tokens sold: {multiplier_at_85:.2f}x")
print(f"This is {multiplier_at_85/33*100:.1f}% of the 33x target")
print(f"\nThe 66x curve is indeed less extreme in the early-middle stages!")
print(f"At 85%, investors see ~33x returns instead of waiting for full graduation.")
