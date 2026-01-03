<div align="center">

# 🌟 OpenCause

### Transparent Crowdfunding Platform with Blockchain Escrow

**Every rupee tracked. Every milestone proven. Every cause trusted.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.3-red)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)](https://pnpm.io/)

[Features](#-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Architecture](#-architecture) • [API Documentation](#-api-documentation) • [Contributing](#-contributing)

</div>

---

## 📖 About

**OpenCause** is a revolutionary crowdfunding platform that brings transparency and trust to charitable giving through blockchain technology. Unlike traditional crowdfunding platforms, OpenCause escrows all donations in smart contracts, ensuring funds are only released when organizers provide verifiable proof of milestone completion.

### Key Differentiators

- 🔒 **Smart Contract Escrow** - All funds held securely in on-chain vaults until milestones are proven
- 📄 **Evidence-Based Releases** - Every withdrawal requires verifiable proof bundles anchored on-chain
- 💎 **Dual Payment Rails** - Accept donations in INR (UPI/cards) or 100+ cryptocurrencies
- 🆔 **Web3 Identity** - DID/VC-based KYC without storing PII on-chain for privacy
- 👁️ **Public Transparency** - Complete ledger of all transactions, proofs, and releases publicly verifiable
- 🛡️ **Anti-Fraud Protection** - Duplicate detection, anomaly scoring, and automated safeguards

---

## ✨ Features

### For Donors
- 🎯 **Browse Campaigns** - Discover verified campaigns with transparent milestones
- 💰 **Multiple Payment Options** - Donate via UPI, cards, or 100+ cryptocurrencies
- 📊 **Real-time Tracking** - See exactly how your donations are being used
- 🔍 **Proof Verification** - Verify evidence and milestone completion on-chain
- 📱 **Mobile-Friendly** - Responsive design for seamless mobile experience

### For Organizers
- 🚀 **Easy Campaign Creation** - Set up campaigns with clear milestones and funding goals
- 💼 **Smart Contract Vaults** - Each campaign gets its own secure on-chain vault
- 📸 **Evidence Submission** - Upload proof bundles (images, documents) anchored to IPFS
- 💸 **Flexible Withdrawals** - Request withdrawals with evidence-backed milestones
- 📈 **Analytics Dashboard** - Track donations, milestones, and campaign performance

### For Reviewers
- ✅ **Evidence Review** - Verify proof bundles before fund release
- 🔐 **Role-Based Access** - Secure reviewer authentication and permissions
- 📋 **Review Dashboard** - Streamlined interface for reviewing withdrawal requests
- ⚡ **Quick Approval** - Efficient workflow for evidence verification

### Platform Features
- 🌐 **Multi-Chain Support** - Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base, Fantom, Bitcoin, Litecoin, Solana
- 🪙 **100+ Cryptocurrencies** - Support for major tokens across all chains
- 🔄 **Real-time Indexing** - Automated blockchain transaction monitoring
- 📦 **IPFS Integration** - Decentralized storage for evidence and proofs
- 🔔 **Notifications** - Real-time updates on campaign activities
- 📊 **The Graph Subgraph** - Indexed blockchain data for fast queries

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **UI Library**: [React 18](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **State Management**: [TanStack Query](https://tanstack.com/query)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Blockchain**: [Ethers.js](https://ethers.org/), [Viem](https://viem.sh/), [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)

### Backend
- **Framework**: [NestJS](https://nestjs.com/) with Fastify
- **Language**: TypeScript
- **Authentication**: JWT with Passport.js
- **Validation**: class-validator, class-transformer
- **Rate Limiting**: @nestjs/throttler
- **Error Tracking**: Sentry

### Blockchain & Smart Contracts
- **Solidity**: Smart contracts written in Solidity
- **Testing**: Foundry
- **Networks**: 
  - EVM: Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base, Fantom
  - UTXO: Bitcoin, Litecoin
  - Solana: Mainnet
- **Indexing**: The Graph Protocol (Subgraph)
- **HD Wallets**: BIP32/BIP39 for deterministic address generation

### Infrastructure
- **Database**: Firebase Firestore
- **File Storage**: Cloudflare R2, IPFS
- **Payments**: Razorpay, Cashfree
- **Worker**: Background job processing for blockchain indexing
- **Deployment**: Vercel (API), Railway, Docker

### Development Tools
- **Package Manager**: pnpm with workspaces
- **Build System**: Turbo (monorepo)
- **Linting**: ESLint
- **Testing**: Jest
- **Type Checking**: TypeScript

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0
- **Git**
- **Firebase Account** (for Firestore)
- **Blockchain RPC URLs** (Alchemy, Infura, or public RPCs)
- **Payment Gateway Keys** (Razorpay/Cashfree - optional for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/devanshranjan10/opencausepublic.git
   cd opencausepublic
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Create `.env` files in the respective app directories:

   **`apps/api/.env`**
   ```env
   # Server
   PORT=4000
   NODE_ENV=development
   
   # Firebase
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-service-account-email
   FIREBASE_PRIVATE_KEY=your-private-key
   
   # JWT
   JWT_SECRET=your-jwt-secret
   JWT_EXPIRES_IN=7d
   
   # Blockchain RPC URLs
   ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
   POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
   BSC_RPC_URL=https://bsc-dataseed.binance.org
   ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
   OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
   AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
   BASE_RPC_URL=https://mainnet.base.org
   FANTOM_RPC_URL=https://rpc.ftm.tools
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   
   # Payment Gateways (Optional)
   RAZORPAY_KEY_ID=your-razorpay-key
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   CASHFREE_APP_ID=your-cashfree-app-id
   CASHFREE_SECRET_KEY=your-cashfree-secret
   
   # IPFS
   IPFS_API_URL=https://ipfs.infura.io:5001/api/v0
   IPFS_PROJECT_ID=your-infura-project-id
   IPFS_PROJECT_SECRET=your-infura-secret
   
   # Cloudflare R2 (Optional)
   R2_ACCOUNT_ID=your-r2-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET_NAME=your-bucket-name
   
   # Sentry (Optional)
   SENTRY_DSN=your-sentry-dsn
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

   **`apps/web/.env.local`**
   ```env
   # Next.js
   NEXT_PUBLIC_API_URL=http://localhost:4000
   
   # Firebase
   NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
   
   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-nextauth-secret
   
   # Sentry (Optional)
   NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
   ```

4. **Build shared packages**
   ```bash
   pnpm --filter @opencause/types build
   pnpm --filter @opencause/crypto-core build
   pnpm --filter @opencause/firebase build
   pnpm --filter @opencause/policy build
   pnpm --filter @opencause/r2 build
   ```

5. **Run development servers**

   **Option 1: Run both apps together (recommended)**
   ```bash
   pnpm dev
   ```

   **Option 2: Run apps separately**
   ```bash
   # Terminal 1 - API
   cd apps/api
   pnpm dev
   
   # Terminal 2 - Web
   cd apps/web
   pnpm dev
   ```

6. **Access the applications**
   - Web App: http://localhost:3000
   - API: http://localhost:4000
   - API Health Check: http://localhost:4000/health

### Running the Worker

The worker processes blockchain transactions and indexes events:

```bash
cd apps/worker
pnpm dev
```

### Building for Production

```bash
# Build all packages and apps
pnpm build

# Or use the production build script
./build-production.sh
```

---

## 🏗️ Architecture

### Monorepo Structure

```
opencausepublic/
├── apps/
│   ├── api/              # NestJS backend API
│   ├── web/              # Next.js frontend
│   ├── worker/           # Background job processor
│   ├── contracts/        # Solidity smart contracts
│   └── subgraph/         # The Graph subgraph
├── packages/
│   ├── crypto-core/      # Cryptocurrency utilities
│   ├── firebase/         # Firebase/Firestore utilities
│   ├── policy/           # Business logic & policies
│   ├── r2/               # Cloudflare R2 storage
│   ├── types/            # Shared TypeScript types
│   └── testkit/          # Testing utilities
└── ...
```

### System Architecture

```
┌─────────────────┐
│   Next.js Web   │
│   (Frontend)    │
└────────┬────────┘
         │
         │ HTTP/REST
         │
┌────────▼────────┐
│   NestJS API    │
│   (Backend)     │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┬─────────────┐
    │         │              │             │
┌───▼───┐ ┌──▼───┐    ┌──────▼──────┐ ┌───▼───┐
│ Fire- │ │ IPFS │    │  Blockchain │ │Payment│
│ base  │ │      │    │   Networks  │ │Gateway│
└───────┘ └──────┘    └─────────────┘ └───────┘
                              │
                         ┌────▼────┐
                         │  Worker │
                         │(Indexer)│
                         └─────────┘
```

### Smart Contract Architecture

- **CampaignFactory**: Deploys new campaign vaults
- **CampaignVault**: Holds funds in escrow for each campaign
- **CampaignNativeVault**: For native tokens (ETH, MATIC, etc.)
- **CampaignTokenVault**: For ERC20 tokens (USDC, USDT, etc.)
- **EvidenceRegistry**: Stores evidence hashes on-chain
- **RoleRegistry**: Manages user roles and permissions

### Data Flow

1. **Campaign Creation**: Organizer creates campaign → Smart contract vault deployed
2. **Donation**: Donor contributes → Funds escrowed in smart contract
3. **Milestone Completion**: Organizer submits evidence → Evidence pinned to IPFS → Hash stored on-chain
4. **Withdrawal Request**: Organizer requests withdrawal → Evidence reviewed
5. **Fund Release**: Reviewer approves → Funds released from smart contract to payee

---

## 📚 API Documentation

### Base URL
```
Development: http://localhost:4000
Production: https://api.opencause.world
```

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Key Endpoints

#### Campaigns
- `GET /campaigns` - List all campaigns
- `GET /campaigns/:id` - Get campaign details
- `POST /campaigns` - Create new campaign (requires auth)
- `PUT /campaigns/:id` - Update campaign (requires auth)

#### Donations
- `POST /donations` - Create donation
- `GET /donations` - List donations (with filters)
- `GET /donations/:id` - Get donation details

#### Crypto Payments
- `POST /crypto/payment-intents` - Create crypto payment intent
- `GET /crypto/payment-intents/:id` - Get payment intent status
- `POST /crypto/verify` - Verify crypto transaction
- `GET /crypto/prices` - Get cryptocurrency prices

#### Withdrawals
- `POST /withdrawals` - Request withdrawal (requires auth)
- `GET /withdrawals` - List withdrawals
- `GET /withdrawals/:id` - Get withdrawal details
- `PUT /withdrawals/:id/approve` - Approve withdrawal (reviewer only)

#### Evidence
- `POST /evidence` - Submit evidence bundle
- `GET /evidence/:id` - Get evidence details
- `GET /evidence/campaign/:campaignId` - Get all evidence for campaign

#### KYC
- `POST /kyc/submit` - Submit KYC documents
- `GET /kyc/status` - Get KYC status
- `POST /kyc/verify` - Verify KYC (admin only)

#### Health & Stats
- `GET /health` - Health check endpoint
- `GET /stats` - Platform statistics

---

## 🔐 Security

OpenCause implements multiple layers of security:

- **Smart Contract Escrow**: Funds cannot be accessed without proper authorization
- **Evidence Verification**: All evidence is hashed and stored on-chain
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: All inputs validated using class-validator
- **CORS Protection**: Configured CORS for allowed origins
- **Security Headers**: XSS, CSRF, and other security headers
- **Private Key Management**: HD wallets with secure key derivation
- **PII Protection**: KYC data encrypted, not stored on-chain

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run API tests
pnpm --filter api test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Test smart contracts
cd apps/contracts
forge test
```

---

## 📦 Deployment

### Vercel (Recommended for API)

The API is configured for Vercel serverless deployment:

```bash
cd apps/api
vercel deploy
```

### Manual Deployment

1. Build the project:
   ```bash
   pnpm build
   ```

2. Set production environment variables

3. Start the API:
   ```bash
   cd apps/api
   pnpm start:prod
   ```

4. Start the web app:
   ```bash
   cd apps/web
   pnpm start
   ```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
5. **Push to the branch** (`git push origin feature/amazing-feature`)
6. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow the existing code style
- Ensure all tests pass before submitting PR

---

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Next.js](https://nextjs.org/) - React framework for production
- [Ethers.js](https://ethers.org/) - Ethereum library
- [The Graph](https://thegraph.com/) - Decentralized indexing protocol
- [IPFS](https://ipfs.io/) - Distributed file system
- [Firebase](https://firebase.google.com/) - Backend infrastructure

---

## 📞 Support

For support, email admin@opencause.world or open an issue in this repository.

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=devanshranjan10/opencausepublic&type=Date)](https://star-history.com/#devanshranjan10/opencausepublic&Date)

---

<div align="center">

**Made with ❤️ by the Team ZenTech**

</div>

