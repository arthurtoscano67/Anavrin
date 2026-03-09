import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { NavLink, useLocation } from "react-router-dom";

import { ROUTES } from "../lib/constants";
import { short } from "../lib/format";

export function Header() {
  const account = useCurrentAccount();
  const location = useLocation();
  const anavrinMode = location.pathname.startsWith("/anavrin");

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-borderSoft bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-xl border text-xl ${anavrinMode ? "border-[#67d8b3]/40 bg-[#67d8b3]/10 text-[#d7fff2]" : "border-purple/40 bg-purple/20"}`}>
            {anavrinMode ? "A" : "M"}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`truncate text-lg font-extrabold tracking-tight ${anavrinMode ? "font-['Space_Grotesk']" : ""}`}>
              {anavrinMode ? "ANAVRIN" : "Martians"}
            </div>
            <div className="truncate text-xs text-gray-400">
              {account
                ? `Connected: ${short(account.address)}`
                : anavrinMode
                  ? "Sui Mainnet • Open-world identity stack"
                  : "Sui Mainnet • Martian battle game"}
            </div>
          </div>
          <div className="shrink-0">
            <ConnectButton />
          </div>
        </div>

        <nav className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 lg:flex lg:w-auto lg:flex-wrap">
          {ROUTES.map((r) => (
            <NavLink
              key={r.path}
              to={r.path}
              end={r.path === "/"}
              className={({ isActive }) =>
                `nav-link flex min-h-[44px] items-center justify-center text-center ${isActive ? 'nav-link-active' : ''}`
              }
            >
              {r.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
