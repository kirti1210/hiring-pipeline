import type { ReactNode } from "react";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

function AppLayout({
  children,
  onLogout,
}: AppLayoutProps) {
  return (
    <div className="app-shell">
      <Navbar onLogout={onLogout} />

      <div className="app-body">
        <Sidebar />

        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
