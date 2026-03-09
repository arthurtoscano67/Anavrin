import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@mysten/dapp-kit";
import { toast } from "sonner";

import { PageShell } from "../components/PageShell";
import { Spinner } from "../components/Spinner";
import { short, toSui } from "../lib/format";
import { useAvatarActions } from "../hooks/useAvatarActions";
import { AnavrinCard } from "../anavrin/components/AnavrinCard";
import { TraitSelector } from "../anavrin/components/TraitSelector";
import { ANAVRIN_CONFIG } from "../anavrin/config/anavrinConfig";
import { useAnavrinActiveIdentity, useAnavrinAdminOwner, useAnavrinMintConfig, useAnavrinOwnedAvatars } from "../anavrin/hooks/useAnavrinChainState";
import { useAnavrinMintPipeline } from "../anavrin/hooks/useAnavrinMintPipeline";
import {
  BODY_TYPE_OPTIONS,
  DEFAULT_AVATAR_DRAFT,
  EMOTE_PACK_OPTIONS,
  EXPRESSION_OPTIONS,
  EYE_COLOR_OPTIONS,
  EYE_STYLE_OPTIONS,
  FACE_STYLE_OPTIONS,
  FACIAL_HAIR_OPTIONS,
  FRAME_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_TYPE_OPTIONS,
  HEIGHT_OPTIONS,
  IDLE_STYLE_OPTIONS,
  MOUTH_STYLE_OPTIONS,
  SKIN_TONE_OPTIONS,
  STARTER_ACCESSORY_OPTIONS,
  STARTER_AURA_OPTIONS,
  STARTER_PANTS_OPTIONS,
  STARTER_SHOES_OPTIONS,
  STARTER_TOP_OPTIONS,
  STYLE_OPTIONS,
  VOICE_OPTIONS,
  WALK_STYLE_OPTIONS,
  getOptionLabel,
} from "../anavrin/lib/avatarSchema";
import { buildAvatarMintMetadata } from "../anavrin/lib/avatarMetadata";
import { AvatarRenderer } from "../anavrin/game/AvatarRenderer";
import { WorldCanvas } from "../anavrin/game/WorldCanvas";
import { resolveExperienceStage, resolveWorldSpawn } from "../anavrin/services/WorldManager";
import type { AvatarDraft, CameraFocus } from "../anavrin/types";

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#87a3bf]">
        {label}
      </div>
      <div className={`mt-2 break-all text-sm text-white ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#87a3bf]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {helper ? <div className="mt-1 text-xs text-[#87a3bf]">{helper}</div> : null}
    </div>
  );
}

function StagePill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <div
      className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] ${
        active
          ? "border-[#67d8b3]/60 bg-[#67d8b3]/12 text-[#d7fff2]"
          : "border-white/10 bg-white/[0.03] text-[#87a3bf]"
      }`}
    >
      {label}
    </div>
  );
}

function parseError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Request failed.";
}

export function AnavrinPage() {
  const { auth, pipelineState, latestIdentity, mintAvatar } = useAnavrinMintPipeline();
  const mintConfig = useAnavrinMintConfig();
  const adminOwner = useAnavrinAdminOwner();
  const activeIdentityQuery = useAnavrinActiveIdentity(auth.activeAddress);
  const ownedAvatars = useAnavrinOwnedAvatars(auth.activeAddress);
  const { pendingAction, pauseMint, resumeMint, setMintPrice } = useAvatarActions();
  const [draft, setDraft] = useState<AvatarDraft>(DEFAULT_AVATAR_DRAFT);
  const [cameraFocus, setCameraFocus] = useState<CameraFocus>("body");
  const [zoom, setZoom] = useState(4.4);
  const [priceDraft, setPriceDraft] = useState("0");

  useEffect(() => {
    if (mintConfig.data?.mintPriceMist) {
      setPriceDraft(mintConfig.data.mintPriceMist);
    }
  }, [mintConfig.data?.mintPriceMist]);

  const metadata = useMemo(() => buildAvatarMintMetadata(draft), [draft]);
  const activeIdentity = latestIdentity ?? activeIdentityQuery.data ?? null;
  const renderDraft = activeIdentity?.draft ?? draft;
  const worldSpawn = useMemo(
    () => resolveWorldSpawn(activeIdentity?.objectId ?? metadata.seed),
    [activeIdentity?.objectId, metadata.seed]
  );
  const experienceStage = resolveExperienceStage({
    hasConnection: Boolean(auth.activeAddress),
    hasIdentity: Boolean(activeIdentity),
    isMinting: pipelineState === "building" || pipelineState === "signing" || pipelineState === "confirming",
  });
  const isAdmin =
    auth.authMethod === "wallet" &&
    Boolean(auth.wallet.address) &&
    auth.wallet.address === adminOwner.data;

  const updateAppearance = <K extends keyof AvatarDraft["appearance"]>(
    key: K,
    value: AvatarDraft["appearance"][K]
  ) => {
    setDraft((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        [key]: value,
      },
    }));
  };

  const updateBehavior = <K extends keyof AvatarDraft["behavior"]>(
    key: K,
    value: AvatarDraft["behavior"][K]
  ) => {
    setDraft((current) => ({
      ...current,
      behavior: {
        ...current.behavior,
        [key]: value,
      },
    }));
  };

  const updateStarterStyle = <K extends keyof AvatarDraft["starter_style"]>(
    key: K,
    value: AvatarDraft["starter_style"][K]
  ) => {
    setDraft((current) => ({
      ...current,
      starter_style: {
        ...current.starter_style,
        [key]: value,
      },
    }));
  };

  const handleWalletConnect = async (walletName: string) => {
    try {
      await auth.wallet.connectByName(walletName);
      auth.selectAuthMethod("wallet");
    } catch (error) {
      toast.error(parseError(error));
    }
  };

  const handleMint = async () => {
    try {
      await mintAvatar(draft);
    } catch (error) {
      toast.error(parseError(error));
    }
  };

  const handleRefreshMintConfig = async () => {
    const result = await mintConfig.refetch();
    if (result.error) {
      toast.error(parseError(result.error));
      return;
    }
    toast.success("Mint config refreshed");
  };

  return (
    <PageShell
      title="ANAVRIN"
      subtitle="AAA-grade identity flow for Sui: connect, create, mint, spawn, and walk into New York City."
    >
      <section className="anavrin-shell overflow-hidden rounded-[36px] border border-[#24435c] p-6 md:p-8">
        <div className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.38em] text-[#8fbde7]">
              Blockchain Native Open World
            </div>
            <h1 className="mt-3 font-['Space_Grotesk'] text-4xl font-bold tracking-tight text-white md:text-5xl">
              Launch identity, mint the avatar NFT, then spawn straight into the city.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c0d0df]">
              Wallet connection, zkLogin, 3D creation, on-chain minting, and world entry all run as one pipeline around{" "}
              <span className="font-semibold text-white">anavrin::avatar</span>.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <StagePill active={experienceStage === "connect"} label="Launch" />
            <StagePill active={experienceStage === "creator"} label="Create" />
            <StagePill active={experienceStage === "minting"} label="Mint" />
            <StagePill active={experienceStage === "spawned"} label="Spawn" />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.84fr_1.1fr_0.96fr]">
        <div className="space-y-5">
          <AnavrinCard title="Access Layer" eyebrow="AuthManager + WalletManager">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {auth.activeAddress ? "Player connected" : "Choose identity gateway"}
                    </div>
                    <div className="mt-1 text-sm text-[#87a3bf]">
                      {auth.activeAddress
                        ? `${auth.authMethod === "wallet" ? "Wallet" : "zkLogin"} • ${short(auth.activeAddress)}`
                        : "Use a Sui wallet or a Google-backed zkLogin session."}
                    </div>
                  </div>
                  <ConnectButton />
                </div>
              </div>

              <div className="grid gap-2">
                {auth.wallet.directory.map((entry) => (
                  <button
                    key={entry.name}
                    type="button"
                    onClick={() => handleWalletConnect(entry.name)}
                    disabled={!entry.installed || auth.wallet.isConnecting}
                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-sm text-white transition hover:border-[#4f88b8]/50 hover:bg-[#4f88b8]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{entry.name}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-[#87a3bf]">
                      {entry.installed ? "Connect" : "Not installed"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">zkLogin</div>
                    <div className="mt-1 text-sm text-[#87a3bf]">
                      Google-backed session with nonce, user salt, proof generation, and an address compatible with Sui mainnet.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => auth.beginZkLogin().catch((error) => toast.error(parseError(error)))}
                    disabled={!auth.zkLoginEnabled || auth.isProcessingZkLogin}
                    className="rounded-full border border-[#67d8b3]/40 bg-[#67d8b3]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#d7fff2] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {auth.isProcessingZkLogin ? "Completing..." : "Continue"}
                  </button>
                </div>
                {!auth.zkLoginEnabled ? (
                  <div className="mt-3 rounded-2xl border border-[#ffb54d]/30 bg-[#ffb54d]/10 px-3 py-3 text-xs text-[#ffe1b2]">
                    Add `VITE_ANAVRIN_ZKLOGIN_GOOGLE_CLIENT_ID`, `VITE_ANAVRIN_ZKLOGIN_SALT_URL`, and `VITE_ANAVRIN_ZKLOGIN_PROOF_URL` to activate zkLogin execution.
                  </div>
                ) : null}
                {auth.zkLoginSession ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#67d8b3]/30 bg-[#67d8b3]/8 px-3 py-3 text-xs text-[#d7fff2]">
                    <span>Active zkLogin: {short(auth.zkLoginSession.address)}</span>
                    <button
                      type="button"
                      className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white"
                      onClick={auth.disconnectZkLogin}
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>

              {auth.activeAddress ? (
                <div className="grid gap-3">
                  <Detail label="Active Address" value={auth.activeAddress} mono />
                  <Detail label="Connected Wallet" value={auth.wallet.walletName ?? "No wallet session"} />
                  <Detail label="Owned Avatars" value={String(ownedAvatars.data?.length ?? 0)} />
                </div>
              ) : null}
            </div>
          </AnavrinCard>

          <AnavrinCard
            title="Contract Control"
            eyebrow="SuiTransactionService"
            action={
              <button
                type="button"
                onClick={handleRefreshMintConfig}
                disabled={mintConfig.isFetching}
                className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#dce8f2]"
              >
                {mintConfig.isFetching ? "Reading..." : "Read Mint Config"}
              </button>
            }
          >
            {mintConfig.isLoading ? (
              <div className="flex items-center gap-3 text-sm text-[#c0d0df]">
                <Spinner />
                Reading MintConfig from Sui mainnet...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric
                    label="Mint Price"
                    value={`${mintConfig.data?.mintPriceMist ?? "0"} MIST`}
                    helper={`≈ ${toSui(mintConfig.data?.mintPriceMist)} SUI`}
                  />
                  <Metric
                    label="Mint Enabled"
                    value={mintConfig.data?.mintEnabled ? "Yes" : "No"}
                    helper={`Treasury: ${mintConfig.data?.treasuryBalanceMist ?? "0"} MIST`}
                  />
                </div>
                <div className="grid gap-3">
                  <Detail label="Package ID" value={ANAVRIN_CONFIG.packageId} mono />
                  <Detail label="Module" value={ANAVRIN_CONFIG.moduleName} mono />
                  <Detail label="Mint Config" value={ANAVRIN_CONFIG.mintConfigId} mono />
                  <Detail label="Transfer Policy" value={ANAVRIN_CONFIG.transferPolicyId} mono />
                  <Detail label="AdminCap Owner" value={adminOwner.data ?? "Unavailable"} mono />
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-sm font-semibold text-white">Admin actions</div>
                  <div className="mt-1 text-sm text-[#87a3bf]">
                    Only the wallet that owns the configured AdminCap can toggle minting or update price.
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => resumeMint().catch(() => undefined)}
                      disabled={!isAdmin || pendingAction !== null}
                      className="rounded-2xl border border-[#67d8b3]/35 bg-[#67d8b3]/10 px-4 py-3 text-sm font-semibold text-[#d7fff2] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingAction === "resume" ? "Resuming..." : "Resume Mint"}
                    </button>
                    <button
                      type="button"
                      onClick={() => pauseMint().catch(() => undefined)}
                      disabled={!isAdmin || pendingAction !== null}
                      className="rounded-2xl border border-[#ff7a7a]/35 bg-[#ff7a7a]/10 px-4 py-3 text-sm font-semibold text-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingAction === "pause" ? "Pausing..." : "Pause Mint"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="input !rounded-2xl !border-white/10 !bg-white/[0.04]"
                      value={priceDraft}
                      onChange={(event) => setPriceDraft(event.target.value)}
                      inputMode="numeric"
                      placeholder="Mint price in MIST"
                    />
                    <button
                      type="button"
                      onClick={() => setMintPrice(priceDraft).catch(() => undefined)}
                      disabled={!isAdmin || pendingAction !== null}
                      className="rounded-2xl border border-[#5fd6ff]/35 bg-[#5fd6ff]/10 px-4 py-3 text-sm font-semibold text-[#d8f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingAction === "set-price" ? "Updating..." : "Set Mint Price"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AnavrinCard>
        </div>

        <div className="space-y-5">
          <AnavrinCard title="Character Creator" eyebrow="AvatarRenderer + AvatarMintService">
            <div className="space-y-6">
              <TraitSelector
                label="Frame"
                value={draft.appearance.frame_type}
                options={FRAME_OPTIONS}
                onChange={(value) => updateAppearance("frame_type", value)}
              />
              <div className="grid gap-6 xl:grid-cols-2">
                <TraitSelector
                  label="Skin Tone"
                  value={draft.appearance.skin_tone}
                  options={SKIN_TONE_OPTIONS}
                  onChange={(value) => updateAppearance("skin_tone", value)}
                />
                <TraitSelector
                  label="Height"
                  value={draft.appearance.height_class}
                  options={HEIGHT_OPTIONS}
                  onChange={(value) => updateAppearance("height_class", value)}
                />
                <TraitSelector
                  label="Body Type"
                  value={draft.appearance.body_type}
                  options={BODY_TYPE_OPTIONS}
                  onChange={(value) => updateAppearance("body_type", value)}
                />
                <TraitSelector
                  label="Face Style"
                  value={draft.appearance.face_style}
                  options={FACE_STYLE_OPTIONS}
                  onChange={(value) => updateAppearance("face_style", value)}
                />
                <TraitSelector
                  label="Hair Type"
                  value={draft.appearance.hair_type}
                  options={HAIR_TYPE_OPTIONS}
                  onChange={(value) => updateAppearance("hair_type", value)}
                />
                <TraitSelector
                  label="Hair Color"
                  value={draft.appearance.hair_color}
                  options={HAIR_COLOR_OPTIONS}
                  onChange={(value) => updateAppearance("hair_color", value)}
                />
                <TraitSelector
                  label="Eye Color"
                  value={draft.appearance.eye_color}
                  options={EYE_COLOR_OPTIONS}
                  onChange={(value) => updateAppearance("eye_color", value)}
                />
                <TraitSelector
                  label="Eye Style"
                  value={draft.appearance.eye_style}
                  options={EYE_STYLE_OPTIONS}
                  onChange={(value) => updateAppearance("eye_style", value)}
                />
                <TraitSelector
                  label="Mouth Style"
                  value={draft.appearance.mouth_style}
                  options={MOUTH_STYLE_OPTIONS}
                  onChange={(value) => updateAppearance("mouth_style", value)}
                />
                <TraitSelector
                  label="Facial Hair"
                  value={draft.appearance.facial_hair}
                  options={FACIAL_HAIR_OPTIONS}
                  onChange={(value) => updateAppearance("facial_hair", value)}
                />
                <TraitSelector
                  label="Expression"
                  value={draft.behavior.expression_profile}
                  options={EXPRESSION_OPTIONS}
                  onChange={(value) => updateBehavior("expression_profile", value)}
                />
                <TraitSelector
                  label="Voice"
                  value={draft.behavior.voice_type}
                  options={VOICE_OPTIONS}
                  onChange={(value) => updateBehavior("voice_type", value)}
                />
                <TraitSelector
                  label="Idle Style"
                  value={draft.behavior.idle_style}
                  options={IDLE_STYLE_OPTIONS}
                  onChange={(value) => updateBehavior("idle_style", value)}
                />
                <TraitSelector
                  label="Walk Style"
                  value={draft.behavior.walk_style}
                  options={WALK_STYLE_OPTIONS}
                  onChange={(value) => updateBehavior("walk_style", value)}
                />
                <TraitSelector
                  label="Style Type"
                  value={draft.behavior.style_type}
                  options={STYLE_OPTIONS}
                  onChange={(value) => updateBehavior("style_type", value)}
                />
                <TraitSelector
                  label="Emote Pack"
                  value={draft.behavior.base_emote_pack}
                  options={EMOTE_PACK_OPTIONS}
                  onChange={(value) => updateBehavior("base_emote_pack", value)}
                />
                <TraitSelector
                  label="Starter Top"
                  value={draft.starter_style.top}
                  options={STARTER_TOP_OPTIONS}
                  onChange={(value) => updateStarterStyle("top", value)}
                />
                <TraitSelector
                  label="Starter Pants"
                  value={draft.starter_style.pants}
                  options={STARTER_PANTS_OPTIONS}
                  onChange={(value) => updateStarterStyle("pants", value)}
                />
                <TraitSelector
                  label="Starter Shoes"
                  value={draft.starter_style.shoes}
                  options={STARTER_SHOES_OPTIONS}
                  onChange={(value) => updateStarterStyle("shoes", value)}
                />
                <TraitSelector
                  label="Starter Accessory"
                  value={draft.starter_style.accessory}
                  options={STARTER_ACCESSORY_OPTIONS}
                  onChange={(value) => updateStarterStyle("accessory", value)}
                />
                <TraitSelector
                  label="Starter Aura"
                  value={draft.starter_style.aura}
                  options={STARTER_AURA_OPTIONS}
                  onChange={(value) => updateStarterStyle("aura", value)}
                />
              </div>
            </div>
          </AnavrinCard>
        </div>

        <div className="space-y-5">
          <AnavrinCard title="Live Avatar Preview" eyebrow="3D Character Creator">
            <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#07111b]">
              <AvatarRenderer
                className="h-[420px] w-full"
                draft={renderDraft}
                focus={cameraFocus}
                zoom={zoom}
                locomotion={experienceStage === "spawned" ? "walk" : "idle"}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["face", "body", "style"] as const).map((focus) => (
                <button
                  key={focus}
                  type="button"
                  onClick={() => setCameraFocus(focus)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                    cameraFocus === focus
                      ? "border-[#67d8b3]/40 bg-[#67d8b3]/10 text-[#d7fff2]"
                      : "border-white/10 bg-white/[0.03] text-[#c0d0df]"
                  }`}
                >
                  {focus}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="text-[11px] uppercase tracking-[0.24em] text-[#87a3bf]">
                Zoom
              </label>
              <input
                className="mt-3 w-full accent-[#67d8b3]"
                type="range"
                min={3.2}
                max={5.8}
                step={0.1}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </div>
          </AnavrinCard>

          <AnavrinCard title="Mint Payload" eyebrow="Auto-Generated Metadata">
            <div className="space-y-3">
              <Detail label="Name" value={metadata.name} />
              <Detail label="Description" value={metadata.description} />
              <Detail label="image_url" value={metadata.image_url} mono />
              <Detail label="portrait_uri" value={metadata.portrait_uri} mono />
              <Detail label="base_model_uri" value={metadata.base_model_uri} mono />
              <div className="grid gap-2">
                {metadata.attributes.map((attribute) => (
                  <div
                    key={`${attribute.trait_type}-${attribute.value}`}
                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white"
                  >
                    <span>{attribute.trait_type}</span>
                    <span className="text-[#9dc0dd]">{attribute.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnavrinCard>

          <AnavrinCard title="Mint + Spawn" eyebrow="Avatar becomes player identity">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">
                  {activeIdentity ? "Active identity ready" : "Mint to enter the open world"}
                </div>
                <div className="mt-1 text-sm text-[#87a3bf]">
                  Minting uses `mint_avatar_free`, waits for confirmation, fetches the new avatar object, then promotes it to the active player identity.
                </div>
              </div>
              <button
                type="button"
                onClick={handleMint}
                disabled={!auth.activeAddress || pipelineState === "building" || pipelineState === "signing" || pipelineState === "confirming"}
                className="w-full rounded-2xl border border-[#5fd6ff]/35 bg-[#5fd6ff]/12 px-4 py-4 text-base font-semibold text-[#d8f7ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pipelineState === "building"
                  ? "Building transaction..."
                  : pipelineState === "signing"
                    ? "Signing transaction..."
                    : pipelineState === "confirming"
                      ? "Confirming on-chain..."
                      : "Mint Avatar and Spawn into NYC"}
              </button>
              {activeIdentity ? (
                <div className="space-y-3">
                  <Detail label="Active Avatar ID" value={activeIdentity.objectId} mono />
                  <Detail label="Identity Name" value={activeIdentity.name} />
                  <Detail
                    label="Behavior Profile"
                    value={`${getOptionLabel(STYLE_OPTIONS, activeIdentity.draft.behavior.style_type)} • ${getOptionLabel(WALK_STYLE_OPTIONS, activeIdentity.draft.behavior.walk_style)}`}
                  />
                </div>
              ) : null}
            </div>
          </AnavrinCard>
        </div>
      </div>

      <AnavrinCard title="Open World Spawn" eyebrow="WorldManager + PlayerController + CameraController">
        {activeIdentity ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Map" value={ANAVRIN_CONFIG.world.mapName} helper="Third-person blockout world" />
              <Metric label="District" value={worldSpawn.district} helper="Spawn zone" />
              <Metric label="Movement" value="WASD" helper="Arrow keys also supported" />
              <Metric label="Identity" value={activeIdentity.name} helper={`Level ${activeIdentity.level}`} />
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[#09131f]">
              <WorldCanvas
                className="h-[560px] w-full"
                draft={renderDraft}
                spawn={worldSpawn}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
            <div className="font-['Space_Grotesk'] text-2xl font-bold text-white">
              New York City opens after mint confirmation
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#87a3bf]">
              The world layer is already wired: spawn selection, third-person camera, player controller, and blockout streets/buildings. Mint the avatar NFT to promote it into the active identity and enter the map immediately.
            </p>
          </div>
        )}
      </AnavrinCard>
    </PageShell>
  );
}
