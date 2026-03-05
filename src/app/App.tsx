import { Navigate, Route, Routes } from "react-router-dom";

import { Header } from "./components/Header";
import { AdminPage } from "./pages/AdminPage";
import { ArenaPage } from "./pages/ArenaPage";
import { BreedPage } from "./pages/BreedPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MintPage } from "./pages/MintPage";
import { MyLegendsPage } from "./pages/MyLegendsPage";

export function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        <Routes>
          <Route path="/" element={<MintPage />} />
          <Route path="/legends" element={<MyLegendsPage />} />
          <Route path="/arena" element={<ArenaPage />} />
          <Route path="/breed" element={<BreedPage />} />
          <Route path="/market" element={<MarketplacePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
