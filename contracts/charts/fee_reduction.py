import matplotlib.pyplot as plt
import numpy as np

# Constants from the smart contract
PRECISION = 10**18
MIN_AMICA_FOR_REDUCTION = 1000  # in tokens (1000 ether in contract)
MAX_AMICA_FOR_REDUCTION = 1_000_000  # in tokens (1,000,000 ether in contract)
BASE_FEE = 10000  # 1% (10000 per million)
MAX_DISCOUNTED_FEE = 0  # 0% (0 per million)

def calculate_fee(amica_balance):
    """
    Calculate the fee based on AMICA holdings using the contract's quadratic curve logic
    """
    # If below minimum threshold, return base fee
    if amica_balance < MIN_AMICA_FOR_REDUCTION:
        return BASE_FEE / 10000  # Convert to percentage

    # If at or above maximum threshold, return max discounted fee
    if amica_balance >= MAX_AMICA_FOR_REDUCTION:
        return MAX_DISCOUNTED_FEE / 10000  # Convert to percentage

    # Calculate fee reduction using quadratic curve
    range_val = MAX_AMICA_FOR_REDUCTION - MIN_AMICA_FOR_REDUCTION
    user_position = amica_balance - MIN_AMICA_FOR_REDUCTION

    # Calculate progress (0 to 1)
    progress = user_position / range_val

    # Apply quadratic curve for smoother reduction
    quadratic_progress = progress ** 2

    # Calculate fee interpolation
    fee_range = BASE_FEE - MAX_DISCOUNTED_FEE
    fee_reduction = fee_range * quadratic_progress

    fee = BASE_FEE - fee_reduction
    return fee / 10000  # Convert to percentage

# Generate data points
amica_balances = np.linspace(0, MAX_AMICA_FOR_REDUCTION * 1.1, 1000)
fees = [calculate_fee(balance) for balance in amica_balances]

# Create the plot
plt.figure(figsize=(12, 8))
plt.plot(amica_balances / 1000, fees, linewidth=2.5, color='#2563eb')

# Add vertical lines for thresholds
plt.axvline(x=MIN_AMICA_FOR_REDUCTION / 1000, color='#ef4444', linestyle='--',
            linewidth=1.5, label=f'Min threshold ({MIN_AMICA_FOR_REDUCTION:,} AMICA)')
plt.axvline(x=MAX_AMICA_FOR_REDUCTION / 1000, color='#10b981', linestyle='--',
            linewidth=1.5, label=f'Max threshold ({MAX_AMICA_FOR_REDUCTION:,} AMICA)')

# Add horizontal lines for fee levels
plt.axhline(y=BASE_FEE / 10000, color='#6b7280', linestyle=':',
            linewidth=1, alpha=0.5, label=f'Base fee ({BASE_FEE / 10000}%)')
plt.axhline(y=MAX_DISCOUNTED_FEE / 10000, color='#6b7280', linestyle=':',
            linewidth=1, alpha=0.5, label=f'Max discount ({MAX_DISCOUNTED_FEE / 10000}%)')

# Highlight the quadratic reduction zone
plt.fill_between(amica_balances / 1000, fees, alpha=0.1, color='#2563eb',
                 where=(amica_balances >= MIN_AMICA_FOR_REDUCTION) &
                       (amica_balances <= MAX_AMICA_FOR_REDUCTION))

# Labels and title
plt.xlabel('AMICA Balance (thousands)', fontsize=12)
plt.ylabel('Fee (%)', fontsize=12)
plt.title('AMICA Fee Reduction Curve (Quadratic)', fontsize=16, fontweight='bold')

# Grid
plt.grid(True, alpha=0.3)

# Legend
plt.legend(loc='upper right', fontsize=10)

# Set y-axis limits and format
plt.ylim(-0.1, 1.1)
plt.gca().yaxis.set_major_formatter(plt.FuncFormatter(lambda y, _: '{:.1%}'.format(y)))

# Set x-axis limits
plt.xlim(0, MAX_AMICA_FOR_REDUCTION * 1.1 / 1000)

# Add annotations
# Annotate the curve behavior
plt.annotate('Constant base fee\n(no reduction)',
            xy=(MIN_AMICA_FOR_REDUCTION / 2 / 1000, BASE_FEE / 10000),
            xytext=(MIN_AMICA_FOR_REDUCTION / 2 / 1000, 0.7),
            arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0.3',
                          color='#6b7280', alpha=0.7),
            fontsize=10, ha='center')

plt.annotate('Quadratic fee reduction',
            xy=(MAX_AMICA_FOR_REDUCTION / 2 / 1000, 0.5),
            xytext=(MAX_AMICA_FOR_REDUCTION / 2 / 1000, 0.7),
            arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=-0.3',
                          color='#6b7280', alpha=0.7),
            fontsize=10, ha='center')

plt.annotate('Maximum discount',
            xy=(MAX_AMICA_FOR_REDUCTION * 1.05 / 1000, MAX_DISCOUNTED_FEE / 10000),
            xytext=(MAX_AMICA_FOR_REDUCTION * 1.05 / 1000, 0.2),
            arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0.3',
                          color='#6b7280', alpha=0.7),
            fontsize=10, ha='center')

# Add a text box with key information
textstr = '\n'.join([
    'Fee Reduction Model:',
    f'• Below {MIN_AMICA_FOR_REDUCTION:,} AMICA: {BASE_FEE/10000:.1%} fee',
    f'• {MIN_AMICA_FOR_REDUCTION:,} - {MAX_AMICA_FOR_REDUCTION:,} AMICA: Quadratic reduction',
    f'• Above {MAX_AMICA_FOR_REDUCTION:,} AMICA: {MAX_DISCOUNTED_FEE/10000:.1%} fee'
])
props = dict(boxstyle='round', facecolor='white', alpha=0.8, edgecolor='#e5e7eb')
plt.text(0.02, 0.98, textstr, transform=plt.gca().transAxes, fontsize=9,
         verticalalignment='top', bbox=props)

plt.tight_layout()
plt.show()

# Print some example calculations
print("Example Fee Calculations:")
print("-" * 50)
test_balances = [0, 500, 1000, 10000, 100000, 500000, 1000000, 1500000]
for balance in test_balances:
    fee = calculate_fee(balance)
    print(f"AMICA Balance: {balance:>10,} | Fee: {fee:.2%}")
