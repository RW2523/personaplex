import React from "react";
import { AppView } from "../types";
import { ICONS } from "../constants";

interface SidebarProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  sidebarOpen?: boolean;
  onCloseSidebar?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, sidebarOpen = false, onCloseSidebar }) => {
  const handleNav = (view: AppView) => {
    setActiveView(view);
    onCloseSidebar?.();
  };

  const navItems = [
    { id: AppView.VOICE_CONVERSATION, label: "Conversation", icon: ICONS.Mic },
  ];

  const sidebarContent = (
    <>
      <div className="px-3 py-4 md:px-4 md:py-5 flex items-center gap-3">
        <img
          src="https://www.ajace.com/wp-content/uploads/2016/12/cropped-logo-32x32.png"
          alt="Ajace"
          className="w-8 h-8 md:w-9 md:h-9 rounded-xl object-contain shrink-0"
        />
        <div className="hidden md:block min-w-0">
          <h1 className="text-base font-bold tracking-tight text-white leading-none truncate">EchoMind</h1>
          <p className="text-[10px] text-cyan-400/80 uppercase tracking-widest font-semibold mt-0.5">Powered by Ajace AI</p>
        </div>
        <div className="flex-1 md:hidden" />
        {onCloseSidebar && (
          <button type="button" onClick={onCloseSidebar} className="md:hidden p-2 -m-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" aria-label="Close menu">
            <ICONS.Close className="w-6 h-6" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 md:px-3 pt-2 md:pt-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNav(item.id)}
            className={`w-full flex items-center justify-center md:justify-start gap-3 px-2 py-3 md:px-3 md:py-3 rounded-xl transition-all duration-200 group min-h-[44px] ${
              activeView === item.id
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.05)]"
                : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
            }`}
          >
            <item.icon className={`w-5 h-5 shrink-0 ${activeView === item.id ? "text-cyan-400" : "group-hover:text-white"}`} />
            <span className="hidden md:block font-medium text-sm truncate">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {onCloseSidebar && (
        <div
          className={`fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-200 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={onCloseSidebar}
          onKeyDown={(e) => e.key === "Escape" && onCloseSidebar()}
          aria-hidden
        />
      )}
      <aside
        className={`
          flex flex-col bg-[#080b14] border-r border-white/5 transition-all duration-300 h-full overflow-y-auto overflow-x-hidden shrink-0
          w-[min(280px,85vw)] md:w-60 lg:w-64
          fixed md:relative inset-y-0 left-0 z-30 md:z-auto
          transform md:transform-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          shadow-xl md:shadow-none
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex-1 flex flex-col min-h-0 md:min-h-full">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
