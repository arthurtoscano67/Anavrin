import { useEffect, useMemo, useState } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { toast } from "sonner";

import { DashboardCard } from "../components/DashboardCard";
import { PageShell } from "../components/PageShell";
import { Spinner } from "../components/Spinner";
import { useAvatarActions } from "../hooks/useAvatarActions";
import { useAvatarAdminState, useAvatarMintConfig } from "../hooks/useAvatarContract";
import { AVATAR_CONTRACT } from "../lib/avatarContract";
import { short, toSui } from "../lib/format";

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-borderSoft bg-black/20 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{label}</div>
      <div className={`mt-2 break-all text-sm text-white ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-borderSoft bg-black/20 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-white">{value}</div>
      {helper && <div className="mt-1 text-xs text-gray-400">{helper}</div>}
    </div>
  );
}

function parseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Request failed.";
}

export function AvatarDashboardPage() {
  const account = useCurrentAccount();
  const mintConfig = useAvatarMintConfig();
  const adminState = useAvatarAdminState();
  const { pendingAction, pauseMint, resumeMint, setMintPrice } = useAvatarActions();
  const [priceInput, setPriceInput] = useState("");

  useEffect(() => {
    if (mintConfig.data?.mintPriceMist) {
      setPriceInput(mintConfig.data.mintPriceMist);
    }
  }, [mintConfig.data?.mintPriceMist]);

  const adminOwner = adminState.data?.ownerAddress ?? "Unknown";
  const isAdmin = Boolean(adminState.data?.connectedIsAdmin);
  const canAdmin = Boolean(account && isAdmin);
  const mintStatusLabel = mintConfig.data?.mintEnabled ? "Enabled" : "Paused";
  const mintStatusTone = mintConfig.data?.mintEnabled
    ? "border-green-400/40 bg-green-500/15 text-green-300"
    : "border-red-400/40 bg-red-500/15 text-red-300";

  const treasuryDisplay = useMemo(() => {
    const balance = mintConfig.data?.treasuryBalanceMist;
    if (!balance) return "Unavailable";
    return `${balance} MIST`;
  }, [mintConfig.data?.treasuryBalanceMist]);

  const onRefreshMintConfig = async () => {
    const result = await mintConfig.refetch();
    if (result.error) {
      toast.error(parseError(result.error));
      return;
    }
    toast.success("Mint config refreshed");
  };

  const onPauseMint = async () => {
    try {
      await pauseMint();
      await Promise.all([mintConfig.refetch(), adminState.refetch()]);
    } catch {
      // Error toasts are already handled by useTxExecutor.
    }
  };

  const onResumeMint = async () => {
    try {
      await resumeMint();
      await Promise.all([mintConfig.refetch(), adminState.refetch()]);
    } catch {
      // Error toasts are already handled by useTxExecutor.
    }
  };

  const onSetPrice = async () => {
    try {
      await setMintPrice(priceInput);
      await mintConfig.refetch();
    } catch {
      // Error toasts are already handled by useTxExecutor.
    }
  };

  return (
    <PageShell
      title="Avatar Dashboard"
      subtitle="Read live contract state and test the first admin/public controls for anavrin::avatar on Sui mainnet."
    >
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="glass-card overflow-hidden rounded-[30px] border border-cyan/20 bg-gradient-to-br from-cyan/12 via-surface to-purple/10 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[11px] uppercase tracking-[0.32em] text-cyan/80">Published Module</div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                `anavrin::avatar`
              </h1>
              <p className="mt-3 text-sm text-gray-300">
                A focused test console for mint controls, contract inspection, and the first PTB-backed admin actions.
              </p>
            </div>

            <div className="grid gap-2 text-sm text-gray-200">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                Network: <span className="font-semibold text-white">Sui Mainnet</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                Wallet:{" "}
                <span className="font-semibold text-white">
                  {account ? short(account.address) : "Not connected"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DashboardCard title="Admin State" eyebrow="Access" tone="gold">
          {adminState.isLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-borderSoft bg-black/20 px-4 py-4 text-sm text-gray-300">
              <Spinner />
              Reading AdminCap ownership...
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${canAdmin ? "border-green-400/35 bg-green-500/15 text-green-300" : "border-white/10 bg-white/5 text-gray-200"}`}>
                {canAdmin ? "Connected wallet can administer this contract" : "Read-only mode"}
              </div>
              <DetailRow label="AdminCap Owner" value={adminOwner} mono />
              <DetailRow
                label="Connected Wallet"
                value={account?.address ?? "Connect wallet to unlock write actions"}
                mono
              />
            </div>
          )}
        </DashboardCard>
      </div>

      {!account && (
        <div className="glass-card rounded-[28px] border border-purple/30 bg-purple/10 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-purple/75">Wallet Required</div>
              <div className="mt-2 text-lg font-bold text-white">Connect a wallet to test admin actions</div>
              <p className="mt-1 text-sm text-gray-300">
                Reads work without a wallet. Writes require the wallet that owns the configured AdminCap.
              </p>
            </div>
            <ConnectButton />
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <DashboardCard title="Contract Info" eyebrow="References" tone="purple">
          <div className="grid gap-3">
            <DetailRow label="Package ID" value={AVATAR_CONTRACT.packageId} mono />
            <DetailRow label="Module Name" value={AVATAR_CONTRACT.module} mono />
            <DetailRow label="Mint Config ID" value={AVATAR_CONTRACT.mintConfigId} mono />
            <DetailRow label="Transfer Policy ID" value={AVATAR_CONTRACT.transferPolicyId} mono />
          </div>
        </DashboardCard>

        <DashboardCard
          title="Mint Config"
          eyebrow="On-Chain State"
          tone="cyan"
          action={
            <button className="btn-ghost text-xs" onClick={onRefreshMintConfig} disabled={mintConfig.isFetching}>
              {mintConfig.isFetching ? "Refreshing..." : "Read Mint Config"}
            </button>
          }
        >
          {mintConfig.isLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-borderSoft bg-black/20 px-4 py-4 text-sm text-gray-300">
              <Spinner />
              Loading MintConfig object from chain...
            </div>
          ) : mintConfig.error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4 text-sm text-red-100">
              {parseError(mintConfig.error)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile
                label="mint_price_mist"
                value={`${mintConfig.data?.mintPriceMist ?? "0"} MIST`}
                helper={`≈ ${toSui(mintConfig.data?.mintPriceMist)} SUI`}
              />
              <MetricTile
                label="mint_enabled"
                value={mintStatusLabel}
                helper={mintConfig.data?.ownerKind === "shared" ? "Shared object" : "Owner state unavailable"}
              />
              <MetricTile label="treasury balance" value={treasuryDisplay} helper={`≈ ${toSui(mintConfig.data?.treasuryBalanceMist)} SUI`} />
              <div className="rounded-2xl border border-borderSoft bg-black/20 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">Status</div>
                <div className="mt-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${mintStatusTone}`}>
                    {mintStatusLabel}
                  </span>
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  Shared config object: {mintConfig.data?.objectId ?? AVATAR_CONTRACT.mintConfigId}
                </div>
              </div>
            </div>
          )}
        </DashboardCard>
      </div>

      <DashboardCard title="Actions" eyebrow="First Controls" tone="neutral">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-borderSoft bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Mint Lifecycle</div>
              <p className="mt-1 text-sm text-gray-400">
                Toggle mint availability using the published AdminCap and shared MintConfig object.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  className="btn-secondary w-full"
                  onClick={onResumeMint}
                  disabled={!canAdmin || pendingAction !== null}
                >
                  {pendingAction === "resume" ? "Resuming..." : "Resume Mint"}
                </button>
                <button
                  className="btn-primary w-full border-red-400/35 bg-red-500/85 hover:bg-red-500"
                  onClick={onPauseMint}
                  disabled={!canAdmin || pendingAction !== null}
                >
                  {pendingAction === "pause" ? "Pausing..." : "Pause Mint"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-borderSoft bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Permissions</div>
              <p className="mt-1 text-sm text-gray-400">
                Admin actions are enabled only when the connected wallet matches the on-chain AdminCap owner.
              </p>
              <div className="mt-3 text-xs text-gray-300">
                Expected owner: <span className="font-mono text-white">{adminOwner}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-borderSoft bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Set Mint Price</div>
                <p className="mt-1 text-sm text-gray-400">
                  Enter a whole-number MIST value. This form sends a programmable transaction block to `set_mint_price`.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
                PTB
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">new_price_mist</span>
                <input
                  className="input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value.replace(/[^\d]/g, ""))}
                />
              </label>
              <button
                className="btn-primary min-h-[48px] md:self-end"
                onClick={onSetPrice}
                disabled={!canAdmin || pendingAction !== null || priceInput.trim().length === 0}
              >
                {pendingAction === "set-price" ? "Saving..." : "Set Mint Price"}
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-borderSoft bg-white/[0.03] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">Current</div>
                <div className="mt-2 text-base font-semibold text-white">
                  {mintConfig.data?.mintPriceMist ?? "0"} MIST
                </div>
              </div>
              <div className="rounded-2xl border border-borderSoft bg-white/[0.03] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">Preview</div>
                <div className="mt-2 text-base font-semibold text-white">
                  {priceInput.trim() || "0"} MIST
                </div>
                <div className="mt-1 text-xs text-gray-400">≈ {toSui(priceInput || "0")} SUI</div>
              </div>
            </div>
          </div>
        </div>
      </DashboardCard>
    </PageShell>
  );
}
