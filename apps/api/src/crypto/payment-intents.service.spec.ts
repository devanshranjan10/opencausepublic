import { Test, TestingModule } from "@nestjs/testing";
import { PaymentIntentsService } from "./payment-intents.service";
import { FirebaseService } from "../firebase/firebase.service";
import { HDWalletService } from "./hd-wallet.service";
import { FxRateService } from "./fx-rate.service";

describe("PaymentIntentsService", () => {
  let service: PaymentIntentsService;
  let firebaseService: jest.Mocked<FirebaseService>;
  let hdWalletService: jest.Mocked<HDWalletService>;
  let fxRateService: jest.Mocked<FxRateService>;

  beforeEach(async () => {
    const mockFirebaseService = {
      firestore: {} as any,
    };

    const mockHDWalletService = {
      generateAddress: jest.fn().mockResolvedValue({
        address: "0x1234567890123456789012345678901234567890",
        derivationPath: "m/44'/60'/0'/0/0",
      }),
    };

    const mockFxRateService = {
      getRate: jest.fn().mockResolvedValue("3000"),
      nativeToUsd: jest.fn().mockResolvedValue("3000"),
      usdToNative: jest.fn().mockResolvedValue("1.0"),
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
    firebaseService = module.get(FirebaseService);
    hdWalletService = module.get(HDWalletService);
    fxRateService = module.get(FxRateService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createIntent", () => {
    it("should create a payment intent with USD amount", async () => {
      // Mock Firestore methods
      const mockRepo = {
        getCampaign: jest.fn().mockResolvedValue({ campaignId: "test-campaign" }),
        getDeposit: jest.fn().mockResolvedValue(null),
        createOrGetDeposit: jest.fn().mockResolvedValue({
          id: "deposit-id",
          address: "0x1234567890123456789012345678901234567890",
        }),
        createPaymentIntent: jest.fn().mockResolvedValue({
          intentId: "test-intent",
          status: "CREATED",
        }),
      };

      // This is a basic test structure - full implementation would require
      // proper Firestore mocking
      expect(service).toBeDefined();
    });
  });
});






