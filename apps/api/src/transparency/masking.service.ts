/**
 * Masking Service
 * Provides utilities for masking sensitive information in public displays
 */

export class MaskingService {
  /**
   * Mask UPI VPA: show first 2 chars + "***" + domain
   * Example: "devansh@okhdfcbank" -> "de***@okhdfcbank"
   */
  static maskUpiVpa(vpa: string): string {
    if (!vpa || vpa.length < 3) return "***";
    
    const atIndex = vpa.indexOf("@");
    if (atIndex === -1) {
      // No @ symbol, mask all but first 2 chars
      return vpa.substring(0, 2) + "***";
    }
    
    const username = vpa.substring(0, atIndex);
    const domain = vpa.substring(atIndex);
    
    if (username.length <= 2) {
      return "***" + domain;
    }
    
    return username.substring(0, 2) + "***" + domain;
  }

  /**
   * Mask bank account: show only last 4 digits
   * Example: "1234567890" -> "****7890"
   */
  static maskBankAccount(accountNumber: string): string {
    if (!accountNumber || accountNumber.length < 4) return "****";
    return "****" + accountNumber.slice(-4);
  }

  /**
   * Mask email: show first 2 chars + "***" + domain
   * Example: "devansh@example.com" -> "de***@example.com"
   */
  static maskEmail(email: string): string {
    if (!email) return "***";
    const atIndex = email.indexOf("@");
    if (atIndex === -1) return "***";
    const username = email.substring(0, atIndex);
    const domain = email.substring(atIndex);
    if (username.length <= 2) return "***" + domain;
    return username.substring(0, 2) + "***" + domain;
  }

  /**
   * Mask phone: show only last 4 digits
   * Example: "+919876543210" -> "****3210"
   */
  static maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return "****";
    return "****" + phone.slice(-4);
  }

  /**
   * Mask transaction hash: show first 6 + "..." + last 4
   * Example: "0x1234567890abcdef..." -> "0x1234...cdef"
   */
  static maskTxHash(txHash: string, startLength = 6, endLength = 4): string {
    if (!txHash || txHash.length < startLength + endLength + 3) {
      return txHash; // Not long enough to mask meaningfully
    }
    return `${txHash.substring(0, startLength)}...${txHash.substring(txHash.length - endLength)}`;
  }

  /**
   * Mask donor name: show first letter + "***"
   * Example: "Devansh" -> "D***"
   */
  static maskDonorName(name: string): string {
    if (!name) return "Anonymous";
    if (name.length <= 1) return name + "***";
    return name.substring(0, 1) + "***";
  }
}






