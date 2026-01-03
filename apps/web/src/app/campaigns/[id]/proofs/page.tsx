"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useParams } from "next/navigation";

export default function ProofsPage() {
  const params = useParams();
  const { data: withdrawals } = useQuery({
    queryKey: ["withdrawals", params.id],
    queryFn: () => apiRequest<any[]>(`/withdrawals/campaign/${params.id}`),
  });

  return (
    <div className="min-h-screen p-8 pt-24">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-5xl font-bold mb-8">Proof Ledger</h1>
        <div className="space-y-4">
          {withdrawals?.map((withdrawal: any) => (
            <div
              key={withdrawal.id}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Withdrawal #{withdrawal.id}</h3>
                  <p className="text-white/60">Amount: ₹{withdrawal.amount}</p>
                </div>
                <span className="px-3 py-1 bg-white/10 rounded text-sm">
                  {withdrawal.status}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-white/60">Evidence Hash: </span>
                  <code className="bg-black/50 px-2 py-1 rounded">
                    {withdrawal.evidenceHash}
                  </code>
                </p>
                {withdrawal.evidenceCid && (
                  <p>
                    <span className="text-white/60">IPFS CID: </span>
                    <code className="bg-black/50 px-2 py-1 rounded">
                      {withdrawal.evidenceCid}
                    </code>
                  </p>
                )}
                {withdrawal.txHash && (
                  <p>
                    <span className="text-white/60">Transaction: </span>
                    <a
                      href={`https://explorer.zkevm.polygon.org/tx/${withdrawal.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {withdrawal.txHash}
                    </a>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


