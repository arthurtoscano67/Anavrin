export const ANAVRIN_CONFIG = {
  appName: "ANAVRIN",
  network: "mainnet",
  packageId: "0xc4eb339c26f7d48d803a369c0da9aff09db346ba62916b915eb68df74d808b76",
  moduleName: "avatar",
  adminCapId: "0x4ec6c9ae13ed139cef04506ac2598b1d26ec66b55a18ddb4fda5e7d6b4eeb5ce",
  mintConfigId: "0x7563c8c50507453abce9d4ed8fc6318f8a4ef37efd8633be8931508c59c4ebf6",
  transferPolicyId: "0xb2c4b85a4baf64cea0bc1e8afe2d36740593d2649295434e1898870dacba05bd",
  publisherId: "0x94c1b7f7bf901b7eedba4a93604ff8e7edc1b5bffd16e274d1631ab55e4b2d0c",
  assets: {
    baseUrl: import.meta.env.VITE_ANAVRIN_ASSETS_BASE_URL ?? "https://assets.anavrin.game",
    portraitPath: "portraits",
    imagePath: "images",
    modelPath: "models/avatars",
    worldPreviewPath: "worlds/nyc-preview.glb",
    previewCharacters: {
      masculine: {
        model: "/anavrin/characters/male/SM_FantasyMale.fbx",
        root: "/anavrin/characters/male",
      },
      feminine: {
        model: "/anavrin/characters/female/SM_FantasyFemale.fbx",
        root: "/anavrin/characters/female",
      },
    },
  },
  zkLogin: {
    callbackPath: "/anavrin",
    googleClientId: import.meta.env.VITE_ANAVRIN_ZKLOGIN_GOOGLE_CLIENT_ID ?? "",
    saltServiceUrl: import.meta.env.VITE_ANAVRIN_ZKLOGIN_SALT_URL ?? "",
    proofServiceUrl: import.meta.env.VITE_ANAVRIN_ZKLOGIN_PROOF_URL ?? "",
    maxEpochOffset: 2,
  },
  world: {
    mapName: "New York City",
    bounds: 54,
    spawnPoint: [0, 0.9, 18] as const,
    spawnHeading: Math.PI,
  },
  storageKeys: {
    wallet: "anavrin:wallet",
    auth: "anavrin:auth",
    zkPending: "anavrin:zklogin:pending",
    zkSession: "anavrin:zklogin:session",
    activeIdentity: "anavrin:identity",
  },
} as const;

export const ANAVRIN_TARGETS = {
  mintAvatarFree: `${ANAVRIN_CONFIG.packageId}::${ANAVRIN_CONFIG.moduleName}::mint_avatar_free`,
  pauseMint: `${ANAVRIN_CONFIG.packageId}::${ANAVRIN_CONFIG.moduleName}::pause_mint`,
  resumeMint: `${ANAVRIN_CONFIG.packageId}::${ANAVRIN_CONFIG.moduleName}::resume_mint`,
  setMintPrice: `${ANAVRIN_CONFIG.packageId}::${ANAVRIN_CONFIG.moduleName}::set_mint_price`,
} as const;

export const ANAVRIN_TYPES = {
  avatar: `${ANAVRIN_CONFIG.packageId}::${ANAVRIN_CONFIG.moduleName}::Avatar`,
  attachment: `${ANAVRIN_CONFIG.packageId}::${ANAVRIN_CONFIG.moduleName}::Attachment`,
  mintConfig: `${ANAVRIN_CONFIG.packageId}::${ANAVRIN_CONFIG.moduleName}::MintConfig`,
  adminCap: `${ANAVRIN_CONFIG.packageId}::${ANAVRIN_CONFIG.moduleName}::AdminCap`,
} as const;

export const ANAVRIN_ZKLOGIN_GOOGLE = {
  key: "google",
  label: "Google",
  issuer: "https://accounts.google.com",
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  scopes: ["openid", "email", "profile"],
} as const;
