import { useNavigate } from "react-router-dom";

import {
  logout,
} from "../../services/auth.service";

interface NavbarProps {
  onLogout: () => void;
}

function Navbar({ onLogout }: NavbarProps) {
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    onLogout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="app-navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">H</div>

        <div>
          <p className="navbar-eyebrow">HIRING PAGE</p>
          <h1>Recruitment Platform</h1>
        </div>
      </div>

      <div className="navbar-actions">
        <span className="navbar-role">
          Recruiter
        </span>

        <button
          type="button"
          className="navbar-logout"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}

export default Navbar;
