'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'
import { Button } from '@/components/Button'

export default function SecurityPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Security</h1>

        <p className="lead">
          Understanding security best practices and how Amica Personas keeps your assets safe.
        </p>

        <h2>Smart Contract Security</h2>

        <h3>Audit Status</h3>

        <p>
          Amica Personas smart contracts have been:
        </p>

        <ul>
          <li>Internally reviewed by experienced Solidity developers</li>
          <li>Tested extensively on Arbitrum Sepolia testnet</li>
          <li>Built using battle-tested OpenZeppelin libraries</li>
        </ul>

        <div className="not-prose my-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>⚠️ Important:</strong> Like all smart contracts, there are inherent risks. Never invest more
            than you can afford to lose. Third-party audit is planned for Q2 2025.
          </p>
        </div>

        <h3>Contract Design</h3>

        <p>
          Our contracts implement multiple security features:
        </p>

        <ul>
          <li><strong>Access Control:</strong> Role-based permissions for administrative functions</li>
          <li><strong>Reentrancy Protection:</strong> Guards against reentrancy attacks</li>
          <li><strong>Safe Math:</strong> Overflow/underflow protection via Solidity 0.8+</li>
          <li><strong>Pausability:</strong> Emergency pause mechanism for critical issues</li>
          <li><strong>Upgradeability:</strong> Proxy pattern for bug fixes without migration</li>
        </ul>

        <h3>Known Limitations</h3>

        <p>
          Be aware of these design considerations:
        </p>

        <ul>
          <li>Persona tokens are standard ERC-20s with no admin controls after deployment</li>
          <li>Liquidity pool ownership transfers to creators (not locked by default)</li>
          <li>No built-in token burning or minting after initial creation</li>
          <li>Price manipulation possible in low-liquidity pools</li>
        </ul>

        <h2>Wallet Security</h2>

        <h3>Best Practices</h3>

        <p>
          Protect your wallet and assets by following these guidelines:
        </p>

        <h4>Never Share Private Keys</h4>

        <ul>
          <li>Amica will NEVER ask for your private keys or seed phrase</li>
          <li>Support team cannot access your wallet</li>
          <li>No legitimate service requires your private keys</li>
        </ul>

        <h4>Use Hardware Wallets</h4>

        <ul>
          <li>Consider using Ledger or Trezor for large holdings</li>
          <li>Hardware wallets keep keys offline and secure</li>
          <li>Fully compatible with Amica via WalletConnect</li>
        </ul>

        <h4>Verify Transactions</h4>

        <ul>
          <li>Always review transaction details before signing</li>
          <li>Check recipient addresses carefully</li>
          <li>Verify token amounts and gas fees</li>
          <li>Be suspicious of unexpected transaction requests</li>
        </ul>

        <h4>Secure Your Device</h4>

        <ul>
          <li>Keep your OS and browser updated</li>
          <li>Use antivirus software</li>
          <li>Avoid public WiFi when transacting</li>
          <li>Don't install suspicious browser extensions</li>
        </ul>

        <h2>Common Scams</h2>

        <h3>Phishing Attacks</h3>

        <p>
          Attackers may try to trick you into revealing sensitive information:
        </p>

        <div className="not-prose my-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <h4 className="text-lg font-semibold text-foreground mb-2">🚨 Red Flags</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Emails asking for wallet credentials or seed phrases</li>
            <li>Fake Amica websites with similar domains (check URL carefully)</li>
            <li>Urgent messages claiming your account is compromised</li>
            <li>Too-good-to-be-true investment opportunities</li>
            <li>Unsolicited direct messages offering "support"</li>
          </ul>
        </div>

        <h3>Rugpulls</h3>

        <p>
          A rugpull occurs when creators drain liquidity, leaving token holders with worthless assets.
        </p>

        <p><strong>Warning Signs:</strong></p>

        <ul>
          <li>Anonymous team with no history</li>
          <li>Excessive creator token allocation (&gt;20%)</li>
          <li>Promises of guaranteed returns</li>
          <li>Unusually high APY or rewards</li>
          <li>No locked liquidity</li>
          <li>Copied/generic website and branding</li>
        </ul>

        <p><strong>Protection:</strong></p>

        <ul>
          <li>Research the creator's history and reputation</li>
          <li>Check if liquidity is locked (view on arbiscan.io)</li>
          <li>Start with small investments to test legitimacy</li>
          <li>Look for community activity and engagement</li>
        </ul>

        <h3>Fake Tokens</h3>

        <p>
          Scammers may create tokens with names similar to popular personas.
        </p>

        <p><strong>Protection:</strong></p>

        <ul>
          <li>Always verify contract addresses</li>
          <li>Use Amica's official interface for trading</li>
          <li>Check token creation date and history</li>
          <li>Look for verification badges (coming soon)</li>
        </ul>

        <h2>Trading Safely</h2>

        <h3>Do Your Own Research (DYOR)</h3>

        <p>
          Before buying any persona token:
        </p>

        <ul>
          <li>Research the creator and their background</li>
          <li>Read the persona description and roadmap</li>
          <li>Check liquidity depth and trading volume</li>
          <li>Review holder distribution (avoid highly concentrated holdings)</li>
          <li>Look for red flags in contract code</li>
        </ul>

        <h3>Risk Management</h3>

        <ul>
          <li>Never invest more than you can afford to lose</li>
          <li>Diversify across multiple personas</li>
          <li>Set stop-losses for volatile positions</li>
          <li>Take profits gradually rather than all at once</li>
          <li>Keep some liquidity for opportunities</li>
        </ul>

        <h3>Slippage and MEV</h3>

        <p>
          Understand risks related to transaction execution:
        </p>

        <ul>
          <li><strong>Slippage:</strong> Price changes between submission and execution</li>
          <li><strong>Front-running:</strong> Bots may see and copy profitable trades</li>
          <li><strong>Sandwich attacks:</strong> Bots manipulate price around your trade</li>
        </ul>

        <p><strong>Mitigation:</strong></p>

        <ul>
          <li>Use appropriate slippage settings (1-3% typical)</li>
          <li>Trade during high liquidity periods</li>
          <li>Consider using MEV protection services</li>
          <li>Split large orders into smaller chunks</li>
        </ul>

        <h2>Reporting Security Issues</h2>

        <h3>Bug Bounty Program</h3>

        <p>
          We take security seriously. If you discover a vulnerability:
        </p>

        <ol>
          <li>Do NOT exploit the vulnerability</li>
          <li>Do NOT publicly disclose the issue</li>
          <li>Contact us immediately via secure channels</li>
          <li>Provide detailed information about the vulnerability</li>
        </ol>

        <p><strong>Contact:</strong></p>

        <ul>
          <li>Email: <a href="mailto:kasumi.null@yandex.com">kasumi.null@yandex.com</a></li>
          <li>PGP Key: Available on request</li>
        </ul>

        <p>
          Rewards may be provided for valid, critical vulnerabilities at the project's discretion.
        </p>

        <h3>Scam Reporting</h3>

        <p>
          If you encounter a scam or suspicious activity:
        </p>

        <ul>
          <li>Report in our <a href="https://t.me/arbius_ai" target="_blank" rel="noopener noreferrer">Telegram</a></li>
          <li>Include contract addresses and evidence</li>
          <li>Warn others in the community</li>
        </ul>

        <h2>Emergency Procedures</h2>

        <h3>If Your Wallet is Compromised</h3>

        <ol>
          <li>Immediately transfer remaining assets to a new wallet</li>
          <li>Revoke all token approvals using revoke.cash</li>
          <li>Document the incident with transaction hashes</li>
          <li>Report to relevant authorities if large amounts involved</li>
          <li>Create a new wallet with a fresh seed phrase</li>
        </ol>

        <h3>If You Fall for a Scam</h3>

        <ol>
          <li>Accept that recovery is unlikely (blockchain transactions are final)</li>
          <li>Document everything: addresses, transactions, communications</li>
          <li>Report to local law enforcement (for large amounts)</li>
          <li>Warn others in community channels</li>
          <li>Learn from the experience and improve security practices</li>
        </ol>

        <div className="not-prose mt-8 p-6 bg-gradient-to-r from-brand-blue/10 to-brand-cyan/10 border border-brand-blue/20 rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">Stay Safe</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Join our community to stay updated on security best practices and warnings.
          </p>
          <Button href="https://t.me/arbius_ai" external>
            Join Telegram
          </Button>
        </div>
      </DocsPageLayout>
    </Layout>
  )
}
