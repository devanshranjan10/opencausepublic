import { CampaignCreated } from "../generated/CampaignFactory/CampaignFactory";
import { Campaign } from "../generated/schema";

export function handleCampaignCreated(event: CampaignCreated): void {
  let campaign = new Campaign(event.params.campaignId.toHex());
  campaign.vault = event.params.vault;
  campaign.organizer = event.params.organizer;
  campaign.title = event.params.title;
  campaign.createdAt = event.block.timestamp;
  campaign.totalRaised = BigInt.fromI32(0);
  campaign.status = "ACTIVE";
  campaign.save();
}


