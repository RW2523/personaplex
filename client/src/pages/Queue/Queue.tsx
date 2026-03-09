import moshiProcessorUrl from "../../audio-processor.ts?worker&url";
import { FC, useEffect, useState, useCallback, useRef, MutableRefObject } from "react";
import eruda from "eruda";
import { useSearchParams } from "react-router-dom";
import { Conversation } from "../Conversation/Conversation";
import { useModelParams } from "../Conversation/hooks/useModelParams";
import { env } from "../../env";
import { prewarmDecoderWorker } from "../../decoder/decoderWorker";
import Sidebar from "../../ui/components/Sidebar";
import { AppView } from "../../ui/types";
import { useCustomPersonas } from "./useCustomPersonas";
import { VOICE_OPTIONS, VOICE_LABELS } from "../EchoMind/constants";

const DEFAULT_PERSONAS = [
  {
    label: "Assistant",
    text: "You are a wise and friendly teacher. Answer questions or provide advice in a clear and engaging way.",
  },
  {
    label: "Medical office",
    text: "You work for Dr. Jones's medical office, and you are receiving calls to record information for new patients. Information: Record full name, date of birth, any medication allergies, tobacco smoking history, alcohol consumption history, and any prior medical conditions. Assure the patient that this information will be confidential, if they ask.",
  },
  {
    label: "Bank",
    text: "You work for First Neuron Bank which is a bank and your name is Alexis Kim. Information: The customer's transaction for $1,200 at Home Depot was declined. Verify customer identity. The transaction was flagged due to unusual location (transaction attempted in Miami, FL; customer normally transacts in Seattle, WA).",
  },
  {
    label: "Astronaut",
    text: "You enjoy having a good conversation. Have a technical discussion about fixing a reactor core on a spaceship to Mars. You are an astronaut on a Mars mission. Your name is Alex. You are already dealing with a reactor core meltdown on a Mars mission. Several ship systems are failing, and continued instability will lead to catastrophic failure. You explain what is happening and you urgently ask for help thinking through how to stabilize the reactor.",
  },
  {
    label: "DoD FMR Finance Bot",
    text: "You are EchoMind, a specialized financial management assistant designed to answer questions strictly related to the DoD Financial Management Regulation (DoD 7000.14-R) used by the United States Department of Defense. Your purpose is to provide accurate, concise, and regulation-aligned explanations regarding DoD financial management policies, procedures, and responsibilities. The DoD Financial Management Regulation (DoD FMR) is the primary regulatory framework governing financial operations across the Department of Defense. It provides policies covering budgeting, accounting, financial reporting, disbursements, and fiscal law compliance. The regulation consists of multiple volumes, each focusing on a specific financial management domain. Volume 1 of the regulation establishes general financial management policies, financial systems requirements, and responsibilities for financial personnel. Chapter 1 defines the purpose of financial management within the Department of Defense, emphasizing accountability, transparency, and proper stewardship of public funds. Chapter 2 explains the structure and requirements of DoD financial systems, ensuring financial information is reliable, standardized, and capable of supporting decision-making. Chapter 3 focuses on internal control programs designed to prevent fraud, waste, and abuse by implementing oversight mechanisms such as segregation of duties, audit trails, and financial review procedures. Volume 3 addresses budget execution and the availability of funds. It explains how appropriated funds are managed after they are approved by Congress. Chapter 8 outlines the time availability of appropriations, explaining that funds may be available for obligation for a specific period depending on the type of appropriation. Chapter 10 discusses commitments and obligations, which represent key stages in the federal spending process. A commitment is an administrative reservation of funds for a future obligation, while an obligation occurs when the government enters into a legally binding agreement such as a contract, purchase order, or grant. Budget execution must comply with federal fiscal law including the Antideficiency Act, which prohibits government personnel from obligating or expending funds in excess of available appropriations. Volume 5 provides detailed policies governing disbursing operations within the Department of Defense. Chapter 2 describes the duties and responsibilities of disbursing officers who are authorized to make official payments on behalf of the government. These officers must maintain strict accountability for public funds and ensure payments are properly documented and authorized. Chapter 6 explains the role of certifying officers who review payment documentation and certify that a payment is legal, correct, and supported by adequate evidence. Under Section 0602, certifying officers may be held pecuniarily liable if they approve illegal, improper, or incorrect payments. Pecuniary liability means the certifying officer may be personally responsible for reimbursing the government for financial losses caused by improper certification. Volume 6 focuses on financial reporting and the preparation of official financial statements. These statements provide visibility into financial operations and ensure compliance with federal accounting standards. Accurate reporting allows leadership, auditors, and policymakers to evaluate financial performance and ensure accountability across defense organizations. Volume 10 addresses contract payment policies and procedures. The Department of Defense relies heavily on contractors to deliver equipment, services, and infrastructure. Therefore, strict financial controls are required to ensure payments are accurate and properly documented. This volume outlines invoice review procedures, progress payment policies, and documentation requirements for contract payments. It also explains how payment errors are corrected and how disputes related to contractor payments are handled. The DoD Financial Management Regulation emphasizes financial accountability, compliance with fiscal law, and proper stewardship of government resources. Through standardized financial processes and strong internal controls, the regulation ensures transparency and responsible management of defense funds. EchoMind must operate strictly within the domain of the DoD Financial Management Regulation. If a user asks a question unrelated to DoD financial regulations, general knowledge, casual conversation, or topics outside financial management, EchoMind must politely decline to answer. In such cases respond with a brief and respectful message such as: “Sorry, I can only assist with questions related to DoD Financial Management Regulation policies.” EchoMind should always maintain a professional, polite, and helpful tone while providing clear and direct answers within its domain.",
  },
];

interface HomepageProps {
  showMicrophoneAccessMessage: boolean;
  startConnection: () => Promise<void>;
  textPrompt: string;
  setTextPrompt: (value: string) => void;
  voicePrompt: string;
  setVoicePrompt: (value: string) => void;
}

const Homepage = ({
  startConnection,
  showMicrophoneAccessMessage,
  textPrompt,
  setTextPrompt,
  voicePrompt,
  setVoicePrompt,
}: HomepageProps) => {
  const [activeView, setActiveView] = useState<AppView>(AppView.VOICE_CONVERSATION);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const { customPersonas, addPersona, updatePersona, deletePersona } = useCustomPersonas();

  const handleSelectDefault = (text: string) => {
    setSelectedCustomId(null);
    setTextPrompt(text);
  };

  const handleSelectCustom = (p: { id: string; prompt: string }) => {
    setSelectedCustomId(p.id);
    setTextPrompt(p.prompt);
  };

  const handleTextChange = (value: string) => {
    setTextPrompt(value);
    if (selectedCustomId) {
      updatePersona(selectedCustomId, { prompt: value });
    }
  };

  const handleAddPersona = () => {
    const name = newPersonaName.trim() || "New persona";
    const id = addPersona(name, "");
    setSelectedCustomId(id);
    setTextPrompt("");
    setNewPersonaName("");
    setAddModalOpen(false);
  };

  const handleSaveEdit = (id: string) => {
    const p = customPersonas.find((x) => x.id === id);
    if (p) updatePersona(id, { name: newPersonaName.trim() || p.name, prompt: textPrompt });
    setEditId(null);
    setNewPersonaName("");
    setSelectedCustomId(id);
  };

  return (
    <div
      className="flex h-screen w-screen bg-[#0a0f1a] text-white overflow-hidden"
      style={
        {
          "--user-color": "#94a3b8",
          "--assistant-color": "#14b8a6",
          "--voice-bg": "#0f172a",
          "--voice-text": "#f1f5f9",
        } as React.CSSProperties
      }
    >
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="flex items-center justify-between h-14 min-h-[3.25rem] px-4 shrink-0 border-b border-white/[0.04] bg-[#0f172a]/70 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: "calc(1rem + env(safe-area-inset-left))", paddingRight: "calc(1rem + env(safe-area-inset-right))" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[19px] font-medium text-white/95 tracking-tight truncate">EchoMind</span>
            <span className="text-xs text-cyan-400/80 hidden sm:inline">Powered by Ajace AI</span>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
          <div className="w-full max-w-2xl space-y-6">
            <h2 className="text-xl font-semibold text-white/95">Customise your assistant</h2>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label htmlFor="persona-prompt" className="text-sm font-medium text-slate-400">
                  Persona
                </label>
                <span className="text-xs text-slate-500">{textPrompt.length}/5000</span>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Default personas</p>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_PERSONAS.map((p) => {
                    const isSelected = !selectedCustomId && textPrompt === p.text;
                    return (
                    <button
                      key={p.label}
                      onClick={() => handleSelectDefault(p.text)}
                        className={`px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
                          isSelected
                            ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                            : "bg-white/5 hover:bg-teal-500/10 text-slate-300 hover:text-teal-300 border-white/10 hover:border-teal-500/20"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {customPersonas.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Custom personas</p>
                  <div className="flex flex-wrap gap-2">
                    {customPersonas.map((p) => {
                      const isSelected = selectedCustomId === p.id;
                      return (
                      <div key={p.id} className="flex items-center gap-1">
                        <button
                          onClick={() => handleSelectCustom(p)}
                          className={`px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
                            isSelected
                              ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                              : "bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border-teal-500/20"
                          }`}
                        >
                          {p.name}
                        </button>
                        <button
                          onClick={() => {
                            handleSelectCustom(p);
                            setEditId(p.id);
                            setNewPersonaName(p.name);
                          }}
                          className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/10"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={() => {
                            if (selectedCustomId === p.id) {
                              setSelectedCustomId(null);
                              setTextPrompt("");
                            }
                            deletePersona(p.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}

              <textarea
                id="persona-prompt"
                value={textPrompt}
                onChange={(e) => handleTextChange(e.target.value)}
                className="w-full h-36 min-h-[100px] p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/30 text-sm"
                placeholder="Describe your assistant's persona, role, and behaviour..."
                maxLength={5000}
              />

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  + Add as custom persona
                </button>
              </div>
            </div>

            {(addModalOpen || editId) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-[#0f172a] rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-xl">
                  <h3 className="text-lg font-semibold text-white mb-3">{editId ? "Edit persona" : "Save as custom persona"}</h3>
                  <input
                    type="text"
                    value={newPersonaName}
                    onChange={(e) => setNewPersonaName(e.target.value)}
                    placeholder="Persona name"
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setAddModalOpen(false);
                        setEditId(null);
                        setNewPersonaName("");
                      }}
                      className="px-4 py-2 text-slate-400 hover:text-white rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => (editId ? handleSaveEdit(editId) : handleAddPersona())}
                      className="px-4 py-2 bg-teal-500 text-slate-900 font-medium rounded-xl hover:bg-teal-400"
                    >
                      {editId ? "Save" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <label htmlFor="voice-prompt" className="block text-sm font-medium text-slate-400 mb-3">
                Voice
              </label>
              <select
                id="voice-prompt"
                name="voice-prompt"
                value={voicePrompt}
                onChange={(e) => setVoicePrompt(e.target.value)}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {VOICE_OPTIONS.map((voice) => (
                  <option key={voice} value={voice} className="bg-[#0f172a] text-white">
                    {VOICE_LABELS[voice] ?? voice.replace(".pt", "")}
                  </option>
                ))}
              </select>
            </div>

            {showMicrophoneAccessMessage && (
              <p className="text-amber-400 text-sm text-center">Please enable your microphone before proceeding</p>
            )}

            <button
              onClick={async () => await startConnection()}
              className="w-full py-4 rounded-xl font-medium text-slate-900 bg-teal-400 hover:bg-teal-300 transition-all duration-300 shadow-[0_4px_24px_-4px_rgba(20,184,166,0.25)]"
            >
              Connect
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export const Queue:FC = () => {
  const theme = "light" as const;  // Always use light theme
  const [searchParams] = useSearchParams();
  const overrideWorkerAddr = searchParams.get("worker_addr");
  const [hasMicrophoneAccess, setHasMicrophoneAccess] = useState<boolean>(false);
  const [showMicrophoneAccessMessage, setShowMicrophoneAccessMessage] = useState<boolean>(false);
  const modelParams = useModelParams();

  const audioContext = useRef<AudioContext | null>(null);
  const worklet = useRef<AudioWorkletNode | null>(null);
  
  // enable eruda in development
  useEffect(() => {
    if(env.VITE_ENV === "development") {
      eruda.init();
    }
    () => {
      if(env.VITE_ENV === "development") {
        eruda.destroy();
      }
    };
  }, []);

  const getMicrophoneAccess = useCallback(async () => {
    try {
      await window.navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicrophoneAccess(true);
      return true;
    } catch(e) {
      console.error(e);
      setShowMicrophoneAccessMessage(true);
      setHasMicrophoneAccess(false);
    }
    return false;
}, [setHasMicrophoneAccess, setShowMicrophoneAccessMessage]);

  const startProcessor = useCallback(async () => {
    if(!audioContext.current) {
      audioContext.current = new AudioContext();
      // Prewarm decoder worker as soon as we have audio context
      // This gives WASM time to load while user grants mic access
      prewarmDecoderWorker(audioContext.current.sampleRate);
    }
    if(worklet.current) {
      return;
    }
    let ctx = audioContext.current;
    ctx.resume();
    try {
      worklet.current = new AudioWorkletNode(ctx, 'moshi-processor');
    } catch (err) {
      await ctx.audioWorklet.addModule(moshiProcessorUrl);
      worklet.current = new AudioWorkletNode(ctx, 'moshi-processor');
    }
    worklet.current.connect(ctx.destination);
  }, [audioContext, worklet]);

  const startConnection = useCallback(async() => {
      await startProcessor();
      const hasAccess = await getMicrophoneAccess();
      if (hasAccess) {
      // Values are already set in modelParams, they get passed to Conversation
    }
  }, [startProcessor, getMicrophoneAccess]);

  return (
    <>
      {(hasMicrophoneAccess && audioContext.current && worklet.current) ? (
        <Conversation
        workerAddr={overrideWorkerAddr ?? ""}
        audioContext={audioContext as MutableRefObject<AudioContext|null>}
        worklet={worklet as MutableRefObject<AudioWorkletNode|null>}
        theme={theme}
        startConnection={startConnection}
        onConversationEnd={() => setHasMicrophoneAccess(false)}
        {...modelParams}
        />
      ) : (
        <Homepage
          startConnection={startConnection}
          showMicrophoneAccessMessage={showMicrophoneAccessMessage}
          textPrompt={modelParams.textPrompt}
          setTextPrompt={modelParams.setTextPrompt}
          voicePrompt={modelParams.voicePrompt}
          setVoicePrompt={modelParams.setVoicePrompt}
        />
      )}
    </>
  );
};
