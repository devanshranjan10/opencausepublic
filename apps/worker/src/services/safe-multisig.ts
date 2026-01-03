/**
 * Safe Multisig Service
 * 
 * Interface for executing withdrawals via Safe multisig
 */

export interface SafeTransaction {
  to: string;
  value: string; // in wei
  data: string;
  operation: 0 | 1; // 0 = call, 1 = delegateCall
  safeTxGas: number;
  baseGas: number;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
}

export interface SafeProposal {
  safeAddress: string;
  transaction: SafeTransaction;
  signatures: string[];
}

export class SafeMultisigService {
  private safeServiceUrl: string;

  constructor(safeServiceUrl?: string) {
    this.safeServiceUrl = safeServiceUrl || "https://safe-transaction-mainnet.safe.global";
  }

  /**
   * Propose a Safe transaction
   */
  async proposeTransaction(
    safeAddress: string,
    transaction: SafeTransaction,
    signature: string
  ): Promise<string> {
    const url = `${this.safeServiceUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
        operation: transaction.operation,
        safeTxGas: transaction.safeTxGas,
        baseGas: transaction.baseGas,
        gasPrice: transaction.gasPrice,
        gasToken: transaction.gasToken,
        refundReceiver: transaction.refundReceiver,
        nonce: transaction.nonce,
        signatures: signature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Safe transaction proposal failed: ${error}`);
    }

    const data = await response.json();
    return data.safeTxHash;
  }

  /**
   * Get transaction details
   */
  async getTransaction(safeTxHash: string): Promise<any> {
    const url = `${this.safeServiceUrl}/api/v1/multisig-transactions/${safeTxHash}/`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch Safe transaction: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if transaction is executed
   */
  async isExecuted(safeTxHash: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction(safeTxHash);
      return tx.isExecuted === true;
    } catch {
      return false;
    }
  }

  /**
   * Get execution transaction hash
   */
  async getExecutionTxHash(safeTxHash: string): Promise<string | null> {
    try {
      const tx = await this.getTransaction(safeTxHash);
      return tx.ethereumTx?.safeTxHash || tx.ethereumTx?.transactionHash || null;
    } catch {
      return null;
    }
  }

  /**
   * Build native token transfer transaction
   */
  buildNativeTransferTransaction(
    to: string,
    amountWei: string,
    nonce: number
  ): SafeTransaction {
    return {
      to,
      value: amountWei,
      data: "0x",
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: "0",
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      nonce,
    };
  }

  /**
   * Build ERC20 transfer transaction
   */
  buildERC20TransferTransaction(
    tokenAddress: string,
    to: string,
    amountWei: string,
    nonce: number
  ): SafeTransaction {
    // ERC20 transfer function signature: transfer(address,uint256)
    const transferSelector = "0xa9059cbb";
    const toAddress = to.slice(2).padStart(64, "0");
    const amount = BigInt(amountWei).toString(16).padStart(64, "0");
    const data = `0x${transferSelector}${toAddress}${amount}`;

    return {
      to: tokenAddress,
      value: "0",
      data,
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: "0",
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      nonce,
    };
  }
}






