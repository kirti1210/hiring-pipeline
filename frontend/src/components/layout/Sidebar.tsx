import {
  NavLink,
} from "react-router-dom";

function Sidebar() {
  const navigationItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: "D",
    },
    {
      label: "Jobs",
      path: "/jobs",
      icon: "J",
    },
    {
      label: "Candidates",
      path: "/candidates",
      icon: "C",
    },
    {
      label: "Interviewer",
      path: "/interviewer",
      icon: "I",
    },
    {
      label: "Alerts",
      path: "/alerts",
      icon: "A",
    },
  ];

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-navigation" aria-label="Main navigation">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <span className="sidebar-icon">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>HIRING PAGE</p>
        <span>Recruitment Management</span>
      </div>
    </aside>
  );
}

export default Sidebar;
