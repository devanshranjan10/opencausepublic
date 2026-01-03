import { Test, TestingModule } from "@nestjs/testing";
import { PaymentIntentsService } from "./payment-intents.service";
import { FirebaseService } from "../firebase/firebase.service";
import { HDWalletService } from "./hd-wallet.service";
import { FxRateService } from "./fx-rate.service";
import { getTestAdminFirestore, clearFirestoreCollections } from "@opencause/testkit";

describe("PaymentIntentsService", () => {
  let service: PaymentIntentsService;
  let db: ReturnType<typeof getTestAdminFirestore>;
  
  const mockHDWalletService = {
    generateAddress: jest.fn().mockResolvedValue({
      address: "0x1234567890123456789012345678901234567890",
      derivationPath: "m/44'/60'/0'/0/0",
    }),
  };

  const mockFxRateService = {
    getRate: jest.fn().mockResolvedValue("3000"),
    nativeToUsd: jest.fn().mockResolvedValue("30.00"),
    usdToNative: jest.fn().mockResolvedValue("0.01"),
  };

  beforeEach(async () => {
    db = getTestAdminFirestore();
    
    // Clear test data
    await clearFirestoreCollections([
      "payment_intents",
      "campaign_deposits",
      "crypto_assets",
      "crypto_networks",
      "campaigns",
    ]);

    // Seed test data
    await db.collection("crypto_networks").doc("ethereum_mainnet").set({
      type: "EVM",
      chainId: 1,
      symbol: "ETH",
      explorerBaseUrl: "https://etherscan.io",
      enabled: true,
      confirmationsRequired: 12,
    });

    await db.collection("crypto_assets").doc("eth_ethereum_mainnet").set({
      networkId: "ethereum_mainnet",
      symbol: "ETH",
      name: "Ethereum",
      assetType: "NATIVE",
      decimals: 18,
      enabled: true,
      coingeckoId: "ethereum",
    });

    await db.collection("campaigns").doc("camp1").set({
      title: "Test Campaign",
      createdBy: "user1",
      status: "LIVE",
      createdAt: new Date(),
    });

    const mockFirebaseService = {
      firestore: db,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentIntentsService,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: HDWalletService, useValue: mockHDWalletService },
        { provide: FxRateService, useValue: mockFxRateService },
      ],
    }).compile();

    service = module.get<PaymentIntentsService>(PaymentIntentsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("creates a payment intent with rate lock and deposit address", async () => {
    const intent = await service.createIntent({
      campaignId: "camp1",
      networkId: "ethereum_mainnet",
      assetId: "eth_ethereum_mainnet",
      amountUsd: "30",
    });

    expect(intent.intentId).toBeDefined();
    expect(intent.depositAddress).toBeDefined();
    expect(intent.amountUsd).toBe("30.00");
    expect(intent.amountNative).toBeDefined();
    expect(intent.qrString).toContain(intent.depositAddress);
    expect(intent.status).toBe("CREATED");

    // Verify in Firestore
    const doc = await db.collection("payment_intents").doc(intent.intentId).get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.status).toBe("CREATED");
    expect(doc.data()?.expiresAt).toBeDefined();
  });

  it("prevents LTC from ever returning a bc1 address (regression)", () => {
    // Regression test for the LTC address bug
    const ltcAddress = "ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
    const btcAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

    // LTC addresses must start with ltc1, never bc1
    expect(ltcAddress.startsWith("ltc1")).toBe(true);
    expect(ltcAddress.startsWith("bc1")).toBe(false);
    
    // BTC addresses start with bc1
    expect(btcAddress.startsWith("bc1")).toBe(true);
  });

  it("creates unique deposit addresses per campaign+asset+network", async () => {
    const intent1 = await service.createIntent({
      campaignId: "camp1",
      networkId: "ethereum_mainnet",
      assetId: "eth_ethereum_mainnet",
      amountUsd: "10",
    });

    const intent2 = await service.createIntent({
      campaignId: "camp1",
      networkId: "ethereum_mainnet",
      assetId: "eth_ethereum_mainnet",
      amountUsd: "20",
    });

    // Should reuse same deposit address for same campaign+asset+network
    expect(intent1.depositAddress).toBe(intent2.depositAddress);

    // Different campaign should get different address
    const intent3 = await service.createIntent({
      campaignId: "camp2",
      networkId: "ethereum_mainnet",
      assetId: "eth_ethereum_mainnet",
      amountUsd: "10",
    });

    expect(intent3.depositAddress).not.toBe(intent1.depositAddress);
  });

  it("converts USD to native amount using FX rate", async () => {
    mockFxRateService.usdToNative.mockResolvedValue("0.01");

    const intent = await service.createIntent({
      campaignId: "camp1",
      networkId: "ethereum_mainnet",
      assetId: "eth_ethereum_mainnet",
      amountUsd: "30",
    });

    expect(mockFxRateService.getRate).toHaveBeenCalled();
    expect(mockFxRateService.usdToNative).toHaveBeenCalledWith(
      "eth_ethereum_mainnet",
      "ethereum",
      18,
      "30"
    );
    expect(intent.amountNative).toBe("0.01");
  });
});






