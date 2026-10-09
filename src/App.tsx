import { useEffect, useState, type ComponentType } from "react";
import {
  Award, CircleHelp, Eye, FileSpreadsheet, History as HistoryIcon,
  LayoutDashboard, MonitorCheck, Settings2, UserRound, WifiOff, Image as ImageIcon,
} from "lucide-react";
import { AppProvider, useApp } from "./state/app";
import { ToastProvider } from "./components/Toast";
import { HomeScreen } from "./screens/Home";
import { BulkScreen } from "./screens/Bulk";
import { IndividualScreen } from "./screens/Individual";
import { PreviewScreen } from "./screens/Preview";
import { LayoutSettingsScreen } from "./screens/LayoutSettings";
import { HistoryScreen } from "./screens/History";
import { DiagnosticsScreen } from "./screens/Diagnostics";
import { HelpScreen } from "./screens/Help";
import { getTemplateInfo } from "./lib/template";
import { Badge } from "./components/ui";
import { cn } from "./utils/cn";

export type ScreenId =
  | "home"
  | "bulk"
  | "individual"
  | "preview"
  | "layout"
  | "history"
  | "diagnostics"
  | "help";

interface NavItem {
  id: ScreenId;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  section?: string;
}

const NAV: NavItem[] = [
  { id: "home", label: "Dashboard", icon: LayoutDashboard, section: "Generate" },
  { id: "bulk", label: "Bulk Generation", icon: FileSpreadsheet },
  { id: "individual", label: "Individual Certificate", icon: UserRound },
  { id: "preview", label: "Certificate Preview", icon: Eye, section: "Manage" },
  { id: "layout", label: "Layout Settings", icon: Settings2 },
  { id: "history", label: "Output History", icon: HistoryIcon },
  { id: "diagnostics", label: "Diagnostics", icon: MonitorCheck, section: "Support" },
  { id: "help", label: "Help & Setup", icon: CircleHelp },
];

const TITLES: Record<ScreenId, { title: string; sub: string }> = {
  home: { title: "Dashboard", sub: "BASIX Certificate Generator" },
  bulk: { title: "Bulk Generation", sub: "Excel → PDFs → ZIP" },
  individual: { title: "Individual Certificate", sub: "One student · live preview · one PDF" },
  preview: { title: "Certificate Preview", sub: "Full-size review of the exact PDF artwork" },
  layout: { title: "Layout Settings", sub: "Template · fonts · field positions" },
  history: { title: "Output History", sub: "Recent exports from this workstation" },
  diagnostics: { title: "Diagnostics", sub: "Live pipeline self-tests" },
  help: { title: "Help & Setup", sub: "Operator guide" },
};

function Shell() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const { assetsVersion } = useApp();
  const [tplOk, setTplOk] = useState<boolean | null>(null);

  useEffect(() => {
    getTemplateInfo("blank").then((t) => setTplOk(!!t.img));
  }, [assetsVersion]);

  const meta = TITLES[screen];

  const renderScreen = () => {
    switch (screen) {
      case "home": return <HomeScreen go={setScreen} />;
      case "bulk": return <BulkScreen />;
      case "individual": return <IndividualScreen />;
      case "preview": return <PreviewScreen />;
      case "layout": return <LayoutSettingsScreen />;
      case "history": return <HistoryScreen />;
      case "diagnostics": return <DiagnosticsScreen />;
      case "help": return <HelpScreen />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#eef1f7] text-navy-900">
      {/* ------------------------------- sidebar ------------------------------ */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-navy-900 text-navy-200">
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-navy-900 shadow-[0_6px_18px_-6px_rgba(201,162,39,0.7)]">
            <Award className="size-6" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-[0.12em] text-white">BASIX</div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-gold-400">
              Certificate Studio
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = screen === n.id;
            return (
              <div key={n.id}>
                {n.section && (
                  <div className="mb-1.5 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-navy-500">
                    {n.section}
                  </div>
                )}
                <button
                  onClick={() => setScreen(n.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-all duration-150",
                    active
                      ? "bg-white/10 text-white shadow-[inset_2px_0_0_0_#2db8ff]"
                      : "text-navy-300 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className={cn("size-4.5 shrink-0 transition-colors", active ? "text-gold-400" : "text-navy-400 group-hover:text-navy-200")} strokeWidth={2} />
                  <span className="truncate">{n.label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        <div className="space-y-2.5 border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-[11px] font-semibold text-navy-300">
            <WifiOff className="size-3.5 text-emerald-400" />
            100% offline · no account needed
          </div>
          <div className="px-1 text-[10px] leading-relaxed text-navy-500">
            BASIX Certificate Generator
            <br />v1.0.0 · renders locally on this PC
          </div>
        </div>
      </aside>

      {/* -------------------------------- main -------------------------------- */}
      <div className="ml-[248px] flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-navy-100 bg-white/80 px-7 backdrop-blur-md">
          <div>
            <h1 className="text-[16px] font-bold leading-tight tracking-tight text-navy-900">{meta.title}</h1>
            <p className="text-[11.5px] leading-tight text-navy-400">{meta.sub}</p>
          </div>
          <div className="flex items-center gap-2">
            {tplOk === true && (
              <Badge tone="green" className="hidden sm:inline-flex">
                <ImageIcon className="size-3.5" /> Template installed
              </Badge>
            )}
            {tplOk === false && (
              <button onClick={() => setScreen("layout")}>
                <Badge tone="amber" className="cursor-pointer transition-shadow hover:shadow">
                  <ImageIcon className="size-3.5" /> Template missing — click to install
                </Badge>
              </button>
            )}
          </div>
        </header>

        <main key={screen} className="min-w-0 flex-1 animate-fade-in px-7 py-7">
          <div className="mx-auto max-w-[1360px]">{renderScreen()}</div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  );
}
