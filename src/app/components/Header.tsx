import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { NavLink } from "react-router-dom";

import { ROUTES } from "../lib/constants";
import { short } from "../lib/format";

export function Header() {
  const account = useCurrentAccount();

  return (
    <header className="sticky top-0 z-40 border-b border-borderSoft bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-purple/40 bg-purple/20 text-xl">💗</div>
          <div>
            <div className="text-lg font-extrabold tracking-tight">Anavrin Legends</div>
            <div className="text-xs text-gray-400">
              {account ? `Connected: ${short(account.address)}` : "Sui Mainnet • Living NFT Game"}
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {ROUTES.map((r) => (
            <NavLink
              key={r.path}
              to={r.path}
              end={r.path === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              {r.label}
            </NavLink>
          ))}
        </nav>

        <ConnectButton />
      </div>
    </header>
  );
}
