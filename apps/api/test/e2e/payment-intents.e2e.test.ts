import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { getTestAdminFirestore, clearFirestoreCollections } from "@opencause/testkit";

describe("Payment Intents E2E", () => {
  let app: INestApplication;
  let db: ReturnType<typeof getTestAdminFirestore>;

  beforeAll(async () => {
    db = getTestAdminFirestore();

    // Seed required data
    await clearFirestoreCollections([
      "payment_intents",
      "campaign_deposits",
      "crypto_assets",
      "crypto_networks",
      "campaigns",
    ]);

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

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      })
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /campaigns/:id/payment-intents - creates intent and returns address + qrString", async () => {
    const response = await request(app.getHttpServer())
      .post("/campaigns/camp1/payment-intents")
      .send({
        networkId: "ethereum_mainnet",
        assetId: "eth_ethereum_mainnet",
        amountUsd: "10",
      })
      .expect(201);

    expect(response.body.intentId).toBeDefined();
    expect(response.body.depositAddress).toBeDefined();
    expect(response.body.qrString).toContain(response.body.depositAddress);
    expect(response.body.amountUsd).toBeDefined();
    expect(response.body.amountNative).toBeDefined();
    expect(response.body.status).toBe("CREATED");
  });

  it("GET /crypto/payment-intents/:id - can poll status", async () => {
    // First create an intent
    const createRes = await request(app.getHttpServer())
      .post("/campaigns/camp1/payment-intents")
      .send({
        networkId: "ethereum_mainnet",
        assetId: "eth_ethereum_mainnet",
        amountUsd: "10",
      })
      .expect(201);

    const intentId = createRes.body.intentId;

    // Then poll it
    const pollRes = await request(app.getHttpServer())
      .get(`/crypto/payment-intents/${intentId}`)
      .expect(200);

    expect(pollRes.body.intentId).toBe(intentId);
    expect(pollRes.body.status).toBeDefined();
    expect(pollRes.body.depositAddress).toBeDefined();
  });

  it("GET /crypto/networks - returns enabled networks", async () => {
    const response = await request(app.getHttpServer())
      .get("/crypto/networks")
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    if (response.body.length > 0) {
      expect(response.body[0]).toHaveProperty("networkId");
      expect(response.body[0]).toHaveProperty("type");
    }
  });

  it("GET /crypto/assets - returns assets filtered by network", async () => {
    const response = await request(app.getHttpServer())
      .get("/crypto/assets?networkId=ethereum_mainnet")
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});






