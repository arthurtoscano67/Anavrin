export const AVATAR_CONTRACT = {
  network: "mainnet",
  packageId: "0xc4eb339c26f7d48d803a369c0da9aff09db346ba62916b915eb68df74d808b76",
  module: "avatar",
  adminCapId: "0x4ec6c9ae13ed139cef04506ac2598b1d26ec66b55a18ddb4fda5e7d6b4eeb5ce",
  mintConfigId: "0x7563c8c50507453abce9d4ed8fc6318f8a4ef37efd8633be8931508c59c4ebf6",
  transferPolicyId: "0xb2c4b85a4baf64cea0bc1e8afe2d36740593d2649295434e1898870dacba05bd",
  publisherId: "0x94c1b7f7bf901b7eedba4a93604ff8e7edc1b5bffd16e274d1631ab55e4b2d0c",
} as const;

export const AVATAR_TARGETS = {
  pauseMint: `${AVATAR_CONTRACT.packageId}::${AVATAR_CONTRACT.module}::pause_mint`,
  resumeMint: `${AVATAR_CONTRACT.packageId}::${AVATAR_CONTRACT.module}::resume_mint`,
  setMintPrice: `${AVATAR_CONTRACT.packageId}::${AVATAR_CONTRACT.module}::set_mint_price`,
} as const;

export const AVATAR_TYPES = {
  adminCap: `${AVATAR_CONTRACT.packageId}::${AVATAR_CONTRACT.module}::AdminCap`,
  mintConfig: `${AVATAR_CONTRACT.packageId}::${AVATAR_CONTRACT.module}::MintConfig`,
  transferPolicy: `0x2::transfer_policy::TransferPolicy<${AVATAR_CONTRACT.packageId}::${AVATAR_CONTRACT.module}::Avatar>`,
} as const;
