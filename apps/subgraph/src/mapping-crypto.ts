import { DonationReceived, WithdrawalExecuted, Vault } from "../generated/schema";
import {
  DonationReceived as DonationReceivedEvent,
  WithdrawalExecuted as WithdrawalExecutedEvent,
} from "../generated/CampaignNativeVault/CampaignNativeVault";
import { Address, BigInt } from "@graphprotocol/graph-ts";

export function handleDonationReceived(event: DonationReceivedEvent): void {
  // Get or create vault
  const vaultId = event.address.toHexString();
  let vault = Vault.load(vaultId);
  if (!vault) {
    vault = new Vault(vaultId);
    vault.campaignId = event.params.campaignId;
    vault.assetId = Address.fromString("0x0000000000000000000000000000000000000000"); // Native
    vault.type = "NATIVE";
    vault.totalDonated = BigInt.fromI32(0);
    vault.createdAt = event.block.timestamp;
    vault.createdAtBlock = event.block.number;
  }
  
  // Update vault totals
  vault.totalDonated = vault.totalDonated.plus(event.params.amount);
  vault.save();
  
  // Create donation entity
  const donationId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const donation = new DonationReceived(donationId);
  donation.campaignId = event.params.campaignId;
  donation.intentId = event.params.intentId;
  donation.donor = event.params.donor;
  donation.amount = event.params.amount;
  donation.token = null; // Native token
  donation.timestamp = event.params.timestamp;
  donation.transactionHash = event.transaction.hash;
  donation.blockNumber = event.block.number;
  donation.vault = vaultId;
  donation.save();
}

export function handleWithdrawalExecuted(event: WithdrawalExecutedEvent): void {
  // Get vault
  const vaultId = event.address.toHexString();
  const vault = Vault.load(vaultId);
  if (!vault) {
    return; // Vault should exist if withdrawal is happening
  }
  
  // Create withdrawal entity
  const withdrawalId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const withdrawal = new WithdrawalExecuted(withdrawalId);
  withdrawal.campaignId = event.params.campaignId;
  withdrawal.withdrawalId = event.params.withdrawalId;
  withdrawal.to = event.params.to;
  withdrawal.amount = event.params.amount;
  withdrawal.token = null; // Native token
  withdrawal.timestamp = event.params.timestamp;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.blockNumber = event.block.number;
  withdrawal.vault = vaultId;
  withdrawal.save();
}






