import {
  ANAVRIN_CONFIG,
  ANAVRIN_TARGETS,
  ANAVRIN_TYPES,
} from "../anavrin/config/anavrinConfig";

export const AVATAR_CONTRACT = {
  network: ANAVRIN_CONFIG.network,
  packageId: ANAVRIN_CONFIG.packageId,
  module: ANAVRIN_CONFIG.moduleName,
  adminCapId: ANAVRIN_CONFIG.adminCapId,
  mintConfigId: ANAVRIN_CONFIG.mintConfigId,
  transferPolicyId: ANAVRIN_CONFIG.transferPolicyId,
  publisherId: ANAVRIN_CONFIG.publisherId,
} as const;

export const AVATAR_TARGETS = {
  pauseMint: ANAVRIN_TARGETS.pauseMint,
  resumeMint: ANAVRIN_TARGETS.resumeMint,
  setMintPrice: ANAVRIN_TARGETS.setMintPrice,
} as const;

export const AVATAR_TYPES = {
  adminCap: ANAVRIN_TYPES.adminCap,
  mintConfig: ANAVRIN_TYPES.mintConfig,
  transferPolicy: `0x2::transfer_policy::TransferPolicy<${AVATAR_CONTRACT.packageId}::${AVATAR_CONTRACT.module}::Avatar>`,
} as const;
