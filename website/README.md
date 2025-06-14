# Amica Personas Website

A multichain dApp for creating and trading AI personas using the Amica protocol.

## Features

- 🌐 **Multichain Support**: Deploy and trade personas on Ethereum, Base, and Arbitrum
- 🎨 **Create Personas**: Launch your own AI persona with custom metadata
- 📈 **Bonding Curve Trading**: Trade persona tokens on an automated bonding curve
- 🎓 **Graduation System**: Personas graduate to Uniswap after reaching threshold
- 💰 **Fee Discounts**: Hold AMICA tokens for trading fee reductions
- 🌉 **Bridge Support**: Wrap/unwrap AMICA tokens across chains
- 📊 **Analytics**: Track volume, trades, and trending personas

## Getting Started

### Prerequisites

- Node.js 16+
- Yarn or npm
- WalletConnect Project ID (get one at https://cloud.walletconnect.com)

### Installation

1. Clone the repository:
```bash
git clone <your-repo>
cd website
```

2. Install dependencies:
```bash
yarn install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your configuration:
   - Add your WalletConnect Project ID
   - Update API URL if needed
   - Add RPC URLs if using custom endpoints

5. Update contract addresses in `src/lib/contracts.ts` with your deployed addresses

### Development

Run the development server:
```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
yarn build
yarn start
```

## Project Structure

```
src/
├── components/        # Reusable React components
├── lib/              # Utilities and configurations
│   ├── api.ts       # API client functions
│   ├── contracts.ts # Contract ABIs and addresses
│   └── wagmi.ts     # Wagmi/RainbowKit config
├── pages/            # Next.js pages
│   ├── index.tsx    # Home/Explore page
│   ├── trending.tsx # Trending personas
│   ├── create.tsx   # Create new persona
│   ├── portfolio.tsx # User portfolio
│   └── persona/     # Dynamic persona pages
└── styles/          # Global styles
```

## Smart Contract Integration

The website interacts with three main contracts:

1. **PersonaTokenFactory**: Creates and manages persona NFTs and tokens
2. **AmicaToken**: The main AMICA token with burn-and-claim mechanism
3. **AmicaBridgeWrapper**: Handles cross-chain bridging

### Key Functions

- `createPersona`: Launch a new persona with bonding curve
- `swapExactTokensForTokens`: Buy persona tokens
- `withdrawTokens`: Claim unlocked tokens after graduation
- `updateAmicaSnapshot`: Update AMICA holdings for fee discounts

## API Integration

The website connects to a Subsquid-based API service that indexes on-chain data. Make sure the API service is running at the URL specified in your environment.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
