import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

import { PageShell } from "../components/PageShell";
import { Spinner } from "../components/Spinner";
import { MODULE, PACKAGE_ID, RENDERER, TREASURY_ID } from "../lib/constants";
import { toMist, toSui } from "../lib/format";
import { useAnavrinData } from "../hooks/useAnavrinData";
import { useTxExecutor } from "../hooks/useTxExecutor";

export function AdminPage() {
  const account = useCurrentAccount();
  const { treasury, adminCapId } = useAnavrinData();
  const { execute } = useTxExecutor();

  const [priceInput, setPriceInput] = useState("0");
  const [enabled, setEnabled] = useState(false);
  const [withdrawTo, setWithdrawTo] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (treasury.data) {
      setPriceInput(toSui(treasury.data.mint_price_mist));
      setEnabled(Boolean(treasury.data.mint_enabled));
    }
  }, [treasury.data]);

  useEffect(() => {
    if (account?.address) setWithdrawTo(account.address);
  }, [account?.address]);

  const capId = adminCapId.data;

  const onSetPrice = async () => {
    if (!capId) return;
    setPending("price");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::set_mint_price`,
        arguments: [tx.object(TREASURY_ID), tx.object(capId), tx.pure.u64(toMist(priceInput))],
      });
      await execute(tx, "Mint price updated");
      await treasury.refetch();
    } finally {
      setPending(null);
    }
  };

  const onToggleEnabled = async () => {
    if (!capId) return;
    const next = !enabled;
    setPending("enabled");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::set_mint_enabled`,
        arguments: [tx.object(TREASURY_ID), tx.object(capId), tx.pure.bool(next)],
      });
      await execute(tx, `Mint ${next ? "enabled" : "paused"}`);
      setEnabled(next);
      await treasury.refetch();
    } finally {
      setPending(null);
    }
  };

  const onWithdrawFees = async () => {
    if (!capId || !withdrawTo) return;
    setPending("withdraw");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::withdraw_fees`,
        arguments: [tx.object(TREASURY_ID), tx.object(capId), tx.pure.address(withdrawTo)],
      });
      await execute(tx, "Treasury fees withdrawn");
      await treasury.refetch();
    } finally {
      setPending(null);
    }
  };

  return (
    <PageShell
      title="Admin"
      subtitle="Admin-only controls for live mint settings and treasury fee management."
    >
      {!account && (
        <div className="glass-card p-4 text-sm text-gray-300">Connect wallet to access admin controls.</div>
      )}

      {account && adminCapId.isLoading && (
        <div className="glass-card p-4 text-sm text-gray-300">Checking AdminCap ownership...</div>
      )}

      {account && !adminCapId.isLoading && !capId && (
        <div className="glass-card p-4 text-sm text-gray-300">This wallet does not hold AdminCap for this package.</div>
      )}

      {capId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass-card space-y-4 p-4">
            <h2 className="text-lg font-bold">Mint Config</h2>

            <div className="grid gap-2 rounded-xl border border-borderSoft bg-black/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Mint Enabled</span>
                <span className={enabled ? "text-green-300" : "text-red-300"}>{enabled ? "Yes" : "Paused"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Current Price</span>
                <span className="font-semibold text-cyan">{toSui(treasury.data?.mint_price_mist)} SUI</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400">Set Mint Price (SUI)</label>
              <input
                className="input"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="1.0"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-primary" onClick={onSetPrice} disabled={pending !== null}>
                {pending === "price" ? <span className="inline-flex items-center gap-2"><Spinner /> Updating...</span> : "Set Price"}
              </button>
              <button className="btn-secondary" onClick={onToggleEnabled} disabled={pending !== null}>
                {pending === "enabled" ? <span className="inline-flex items-center gap-2"><Spinner /> Saving...</span> : enabled ? "Pause Mint" : "Enable Mint"}
              </button>
            </div>
          </div>

          <div className="glass-card space-y-4 p-4">
            <h2 className="text-lg font-bold">Treasury Fees</h2>

            <div className="rounded-xl border border-borderSoft bg-black/20 p-3">
              <div className="text-xs text-gray-400">Current Balance</div>
              <div className="mt-1 text-2xl font-bold text-cyan">{toSui(treasury.data?.fees)} SUI</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400">Withdraw Destination</label>
              <input
                className="input"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
                placeholder="0x..."
              />
            </div>

            <button className="btn-primary w-full" onClick={onWithdrawFees} disabled={!withdrawTo || pending !== null}>
              {pending === "withdraw" ? <span className="inline-flex items-center gap-2"><Spinner /> Withdrawing...</span> : "Withdraw Fees"}
            </button>

            <p className="text-xs text-gray-400">
              Renderer URL: <span className="font-mono">{RENDERER}</span>
            </p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
