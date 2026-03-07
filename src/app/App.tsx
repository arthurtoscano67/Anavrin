import { Navigate, Route, Routes } from "react-router-dom";

import { Header } from "./components/Header";
import { AdminPage } from "./pages/AdminPage";
import { BattlePage } from "./pages/BattlePage";
import { BreedPage } from "./pages/BreedPage";
import { GalleryPage } from "./pages/GalleryPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LobbyPage } from "./pages/LobbyPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MintPage } from "./pages/MintPage";
import { MyLegendsPage } from "./pages/MyLegendsPage";
import { QueuePage } from "./pages/QueuePage";
import { SpectatePage } from "./pages/SpectatePage";

export function App() {
  return (
    <div className="safe-bottom min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        <Routes>
          <Route path="/" element={<MintPage />} />
          <Route path="/legends" element={<Navigate to="/my-monsters" replace />} />
          <Route path="/my-monsters" element={<MyLegendsPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/arena" element={<Navigate to="/lobby" replace />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/battle/:matchId" element={<BattlePage />} />
          <Route path="/spectate/:matchId" element={<SpectatePage />} />
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
