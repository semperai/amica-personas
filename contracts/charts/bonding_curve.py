#!/usr/bin/env python3
"""
Bonding Curve Visualizer for Amica Protocol

This script visualizes the bonding curve behavior showing:
- Price progression as tokens are sold
- Cost to buy at different points
- Average price from start
- Price multipliers

Usage: python bonding_curve_viz.py --curve 10532 --pricing 333
"""

import argparse
import matplotlib.pyplot as plt
import numpy as np
from decimal import Decimal, getcontext

# Set high precision for calculations
getcontext().prec = 50

class BondingCurve:
    def __init__(self, curve_multiplier, pricing_multiplier):
        self.curve_multiplier = Decimal(curve_multiplier)
        self.pricing_multiplier = Decimal(pricing_multiplier) / Decimal(1e18)
        self.total_supply = Decimal(333_333_333) * Decimal(1e18)
        self.precision = Decimal(1e18)

    def get_virtual_reserves(self, reserve_sold, reserve_total):
        """Calculate virtual reserves at any point on the curve"""
        # Virtual buffer b = reserveTotal / (√133 - 1)
        virtual_buffer = (reserve_total * Decimal(1000)) / self.curve_multiplier

        # Virtual token reserve = unsold tokens + buffer
        virtual_token = reserve_total - reserve_sold + virtual_buffer

        # Calculate constant k from initial state
        initial_reserve = reserve_total + virtual_buffer
        k = initial_reserve * initial_reserve

        # Maintain constant k: virtualETH = k / virtualToken
        virtual_eth = k / virtual_token

        return virtual_token, virtual_eth

    def get_current_price(self, reserve_sold):
        """Get the current spot price per token"""
        virtual_token, virtual_eth = self.get_virtual_reserves(reserve_sold, self.total_supply)

        # Price = virtualETH / virtualToken
        raw_price = virtual_eth / virtual_token

        # Apply pricing multiplier
        adjusted_price = raw_price * self.pricing_multiplier

        return adjusted_price

    def calculate_amount_out(self, amount_in, reserve_sold):
        """Calculate token output for a given input when buying"""
        if self.total_supply <= reserve_sold:
            return Decimal(0)

        virtual_token, virtual_eth = self.get_virtual_reserves(reserve_sold, self.total_supply)

        # Apply pricing multiplier to input
        adjusted_amount_in = amount_in * self.pricing_multiplier

        # Apply constant product formula
        numerator = virtual_token * adjusted_amount_in
        denominator = virtual_eth + adjusted_amount_in

        virtual_token_out = numerator / denominator

        # Cap output at available tokens
        tokens_remaining = self.total_supply - reserve_sold
        token_out = min(virtual_token_out, tokens_remaining)

        return token_out

def simulate_bonding_curve(curve_multiplier, pricing_multiplier):
    """Simulate the entire bonding curve lifecycle"""
    bc = BondingCurve(curve_multiplier, pricing_multiplier)

    # Data collection
    percentages = []
    tokens_sold = []
    spot_prices = []
    avg_prices = []
    price_multipliers = []
    cumulative_costs = []
    incremental_costs = []

    # Starting price
    starting_price = bc.get_current_price(Decimal(0))

    # Simulate buying in small increments
    total_spent = Decimal(0)
    total_bought = Decimal(0)
    increment = Decimal(1000) * Decimal(1e18)  # Buy 1000 AMICA worth at a time

    while total_bought < bc.total_supply * Decimal(0.85):  # Up to 85% (graduation threshold)
        # Calculate tokens received for this increment
        tokens_received = bc.calculate_amount_out(increment, total_bought)

        if tokens_received == 0:
            break

        total_spent += increment
        total_bought += tokens_received

        # Calculate metrics
        percentage = float((total_bought / bc.total_supply) * Decimal(100))
        spot_price = float(bc.get_current_price(total_bought) / Decimal(1e18))
        avg_price = float((total_spent / total_bought) / Decimal(1e18)) if total_bought > 0 else 0
        price_mult = float((bc.get_current_price(total_bought) / starting_price) * Decimal(100))

        percentages.append(percentage)
        tokens_sold.append(float(total_bought / Decimal(1e18)))
        spot_prices.append(spot_price)
        avg_prices.append(avg_price)
        price_multipliers.append(price_mult)
        cumulative_costs.append(float(total_spent / Decimal(1e18)))

        # Don't try to buy more than available
        if total_bought >= bc.total_supply * Decimal(0.849):
            break

    # Calculate incremental costs for each 10%
    milestones = {}
    for i, pct in enumerate(percentages):
        milestone = int(pct / 10) * 10
        if milestone > 0 and milestone not in milestones and milestone <= 80:
            if milestone == 10:
                incremental = cumulative_costs[i]
            else:
                prev_milestone_idx = next(j for j, p in enumerate(percentages) if p >= milestone - 10)
                incremental = cumulative_costs[i] - cumulative_costs[prev_milestone_idx]

            milestones[milestone] = {
                'tokens': tokens_sold[i],
                'total_cost': cumulative_costs[i],
                'incremental_cost': incremental,
                'spot_price': spot_prices[i],
                'avg_price': avg_prices[i],
                'price_multiplier': price_multipliers[i]
            }

    return {
        'percentages': percentages,
        'tokens_sold': tokens_sold,
        'spot_prices': spot_prices,
        'avg_prices': avg_prices,
        'price_multipliers': price_multipliers,
        'cumulative_costs': cumulative_costs,
        'milestones': milestones,
        'starting_price': float(starting_price / Decimal(1e18)),
        'final_tokens': float(total_bought / Decimal(1e18)),
        'final_cost': float(total_spent / Decimal(1e18)),
        'final_avg_price': float((total_spent / total_bought) / Decimal(1e18)) if total_bought > 0 else 0
    }

def create_visualization(data, curve_multiplier, pricing_multiplier):
    """Create comprehensive visualization of bonding curve behavior"""
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
    fig.suptitle(f'Bonding Curve Analysis\nCurve Multiplier: {curve_multiplier}, Pricing Multiplier: {pricing_multiplier/1e18:.3f}x',
                 fontsize=16)

    # 1. Price Progression
    ax1.plot(data['percentages'], data['spot_prices'], 'b-', linewidth=2, label='Spot Price')
    ax1.plot(data['percentages'], data['avg_prices'], 'r--', linewidth=2, label='Average Price')
    ax1.axhline(y=3, color='g', linestyle=':', label='Target (3 AMICA/persona)')
    ax1.set_xlabel('Tokens Sold (%)')
    ax1.set_ylabel('Price (AMICA per Persona Token)')
    ax1.set_title('Price Progression')
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    ax1.set_xlim(0, 85)

    # 2. Cumulative Cost
    ax2.plot(data['percentages'], data['cumulative_costs'], 'g-', linewidth=2)
    ax2.axhline(y=1_000_000, color='r', linestyle=':', label='Target (1M AMICA)')
    ax2.set_xlabel('Tokens Sold (%)')
    ax2.set_ylabel('Cumulative Cost (AMICA)')
    ax2.set_title('Total AMICA Spent')
    ax2.grid(True, alpha=0.3)
    ax2.legend()
    ax2.set_xlim(0, 85)

    # 3. Price Multiplier
    ax3.plot(data['percentages'], data['price_multipliers'], 'purple', linewidth=2)
    ax3.set_xlabel('Tokens Sold (%)')
    ax3.set_ylabel('Price Multiplier (%)')
    ax3.set_title('Price Multiplier vs Starting Price')
    ax3.grid(True, alpha=0.3)
    ax3.set_xlim(0, 85)

    # 4. Milestone Summary Table
    ax4.axis('tight')
    ax4.axis('off')

    # Create milestone table
    headers = ['Milestone', 'Tokens (M)', 'Total Cost (K)', 'Incr. Cost (K)', 'Spot Price', 'Avg Price', 'Multiplier']
    table_data = []

    # Add starting info
    table_data.append([
        'Start',
        '0',
        '0',
        '-',
        f"{data['starting_price']:.3f}",
        '-',
        '100%'
    ])

    # Add milestones
    for milestone in sorted(data['milestones'].keys()):
        m = data['milestones'][milestone]
        table_data.append([
            f"{milestone}%",
            f"{m['tokens']/1e6:.1f}",
            f"{m['total_cost']/1e3:.1f}",
            f"{m['incremental_cost']/1e3:.1f}",
            f"{m['spot_price']:.3f}",
            f"{m['avg_price']:.3f}",
            f"{m['price_multiplier']:.0f}%"
        ])

    # Add final summary
    table_data.append([
        'Final',
        f"{data['final_tokens']/1e6:.1f}",
        f"{data['final_cost']/1e3:.1f}",
        '-',
        '-',
        f"{data['final_avg_price']:.3f}",
        '-'
    ])

    table = ax4.table(cellText=table_data, colLabels=headers, loc='center', cellLoc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.2, 1.5)

    # Style the table
    for i in range(len(headers)):
        table[(0, i)].set_facecolor('#40466e')
        table[(0, i)].set_text_props(weight='bold', color='white')

    ax4.set_title('Milestone Summary', pad=20)

    plt.tight_layout()

    # Print summary to console
    print(f"\n=== Bonding Curve Summary ===")
    print(f"Curve Multiplier: {curve_multiplier}")
    print(f"Pricing Multiplier: {pricing_multiplier/1e18:.3f}x")
    print(f"Starting Price: {data['starting_price']:.3f} AMICA per Persona Token")
    print(f"Final Tokens Bought: {data['final_tokens']/1e6:.2f}M ({data['final_tokens']/3.33333333e8*100:.1f}%)")
    print(f"Total AMICA Spent: {data['final_cost']/1e3:.1f}K")
    print(f"Final Average Price: {data['final_avg_price']:.3f} AMICA per Persona Token")
    print(f"Price Ratio (Final Avg / Target): {data['final_avg_price']/3:.2f}x")

    return fig

def main():
    parser = argparse.ArgumentParser(description='Visualize Amica Protocol Bonding Curve')
    parser.add_argument('--curve', type=int, default=10532,
                       help='Curve multiplier (default: 10532)')
    parser.add_argument('--pricing', type=int, default=333,
                       help='Pricing multiplier in ether units (default: 333 = 0.333x)')
    parser.add_argument('--save', type=str, default=None,
                       help='Save plot to file (e.g., plot.png)')

    args = parser.parse_args()

    # Convert pricing to wei (multiply by 1e18)
    pricing_multiplier = args.pricing * int(1e18)

    print(f"Simulating bonding curve with:")
    print(f"  Curve multiplier: {args.curve}")
    print(f"  Pricing multiplier: {args.pricing/1000:.3f}x")

    # Run simulation
    data = simulate_bonding_curve(args.curve, pricing_multiplier)

    # Create visualization
    fig = create_visualization(data, args.curve, pricing_multiplier)

    if args.save:
        plt.savefig(args.save, dpi=300, bbox_inches='tight')
        print(f"\nPlot saved to {args.save}")
    else:
        plt.show()

if __name__ == "__main__":
    main()
