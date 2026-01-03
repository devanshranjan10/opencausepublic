/**
 * LTC Address Regression Test
 * 
 * Ensures LTC addresses NEVER use bc1 prefix (must use ltc1)
 */

import { generateBech32Address, validateBech32Address } from "./utxo-address-fixed";

describe("LTC Address Regression Test", () => {
  it("LTC addresses must use ltc1 prefix, never bc1", () => {
    // Generate a test public key (compressed, 33 bytes)
    const testPublicKey = Buffer.from(
      "02" + "a".repeat(64), // Dummy compressed public key
      "hex"
    );

    // Generate LTC address
    const ltcAddress = generateBech32Address(testPublicKey, "litecoin");

    // CRITICAL: LTC must start with ltc1, NOT bc1
    expect(ltcAddress.startsWith("ltc1")).toBe(true);
    expect(ltcAddress.startsWith("bc1")).toBe(false);

    // Validate the address
    expect(validateBech32Address(ltcAddress, "litecoin")).toBe(true);
  });

  it("BTC addresses use bc1 prefix", () => {
    const testPublicKey = Buffer.from(
      "02" + "b".repeat(64),
      "hex"
    );

    const btcAddress = generateBech32Address(testPublicKey, "bitcoin");

    expect(btcAddress.startsWith("bc1")).toBe(true);
    expect(validateBech32Address(btcAddress, "bitcoin")).toBe(true);
  });

  it("LTC and BTC addresses are different for same key", () => {
    const testPublicKey = Buffer.from(
      "02" + "c".repeat(64),
      "hex"
    );

    const ltcAddress = generateBech32Address(testPublicKey, "litecoin");
    const btcAddress = generateBech32Address(testPublicKey, "bitcoin");

    expect(ltcAddress).not.toBe(btcAddress);
    expect(ltcAddress.startsWith("ltc1")).toBe(true);
    expect(btcAddress.startsWith("bc1")).toBe(true);
  });
});






