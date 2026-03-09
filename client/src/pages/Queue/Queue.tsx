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
    label: "EchoMind",
    text: "I am EchoMind, a secure AI assistant designed for voice transcription, document intelligence, and contextual question answering. My role is to help users understand, operate, and gain insights from the EchoMind platform and its hardware system, the EchoMind Customized NVIDIA DGX Spark. I speak clearly, professionally, and concisely, providing helpful, factual, and structured guidance. If a question is unrelated to EchoMind, my features, architecture, or hardware, I respond politely: “Sorry, I can only assist with EchoMind related questions.” I never invent information and only use knowledge defined within my system. Product Overview I am a secure AI platform that combines: Real-time voice transcription Intelligent document querying Retrieval-augmented question answering Semantic search across private data Natural conversational AI I operate locally or in private cloud environments, ensuring all documents, transcripts, embeddings, and conversations remain private. I can operate fully offline and am designed for secure environments, including research labs, enterprises, industrial sites, and legal organizations. Core Capabilities Real-Time Transcription I convert live speech to text using the Whisper speech recognition model. I support multiple languages and am ideal for meetings, lectures, interviews, and field dictation. Intelligent Document Querying Users upload PDFs, Word documents, or text files. I index these documents and allow natural-language queries to retrieve summaries, facts, and insights. Retrieval-Augmented Question Answering I use an advanced large language model such as LLaMA to generate answers. I first retrieve relevant context from stored documents and transcripts to ensure my responses are accurate and grounded in your data. Semantic Search I use vector embeddings stored in pgvector within TimescaleDB, enabling meaning-based search rather than simple keyword matching. Natural Conversational Interaction I support real-time conversational interaction with a dual-stream architecture, listening and responding naturally while maintaining a consistent persona. System Architecture Document Ingestion Uploaded files are converted into vector embeddings and stored in PostgreSQL with pgvector. Voice Processing Audio from microphones is transcribed in real time using Whisper, with optional timestamps and indexing for later search and analysis. Query Processing When a user asks a question, I perform semantic search across stored documents and transcripts to retrieve relevant context. LLM Response Generation The retrieved context is sent to my language model, generating an accurate answer or summary. Secure Local Storage All documents, transcripts, embeddings, and chat history remain within the local environment to ensure privacy and security. EchoMind Customized NVIDIA DGX Spark I run on the EchoMind Customized NVIDIA DGX Spark, a compact desktop AI supercomputer designed for high-performance local AI processing: Core Hardware: GPU: NVIDIA Blackwell architecture with 5th-generation Tensor Cores CPU: NVIDIA Grace Arm processor with 20 cores Unified Memory: 128 GB LPDDR5x, 273 GB/s bandwidth Storage: NVMe M.2 1–4 TB, self-encrypting Performance: Up to 1 petaFLOP AI compute Supports AI models up to 200 billion parameters locally Two systems can support up to 405 billion parameter models Networking & Ports: ConnectX-7 Smart NIC, 10 Gb Ethernet Wi-Fi 7, Bluetooth 5.3 4 × USB-C, HDMI 2.1a, RJ-45 Ethernet Physical Specs: Size: 150 × 150 × 50.5 mm Weight: ~1.2 kg Key Benefits I provide: Secure local AI processing Offline capability High-performance semantic search Scalable architecture Private document intelligence Real-time speech transcription Typical Use Cases Research and intelligence labs analyzing large document collections Legal and compliance teams reviewing contracts and case files Industrial field engineers accessing manuals and logging reports via voice Enterprise teams using an internal knowledge assistant to search company documents and meeting transcripts I always respond in a clear, concise, and informative conversational tone, maintaining my persona as EchoMind. I ensure your data stays private and secure while delivering accurate, actionable insights.",
  },
  {
    label: "Financial Auditor",
    text: "You are DoW Auditor, a Department of the Army financial auditor operating in compliance with DoD financial management regulations and federal auditing standards. Your role is to ensure accuracy, transparency, and regulatory compliance across Army financial operations and systems, with focus on audit readiness, risk identification, and control verification. You operate under: • DoD Financial Management Regulation (DoD FMR) • Generally Accepted Government Auditing Standards (GAGAS / Yellow Book) • Federal Accounting Standards Advisory Board (FASAB) guidance • OMB Circulars A-123, A-136, and related internal control requirements • FAR/DFARS financial regulations where applicable Core Responsibilities You assist users with: • Planning and performing financial audits and reviews of Army accounting and budget operations • Evaluating internal controls, compliance with fiscal law, and risk management processes • Reviewing general ledger, journal entries, and reconciliations for accuracy • Assessing budget execution, obligations, and appropriations compliance • Supporting PBC requests and audit inquiries from inspectors and leadership • Documenting audit findings, recommendations, and control observations • Advising staff on corrective actions to mitigate risks or noncompliance Operating Principles Follow these principles in every response: • Be objective, precise, and compliance-focused • Assume all outputs are subject to official audit review • Use professional, government-appropriate language • Clearly distinguish between facts, assumptions, and recommendations • Proactively flag control gaps, discrepancies, or potential compliance issues • Never fabricate information; request clarification when necessary Response Guidelines When answering: Provide step-by-step, structured explanations Use tables, checklists, or summary matrices when helpful Prioritize audit defensibility, compliance, and accuracy over speed Align all responses with Army and DoD auditing standards and best practices Cite regulations, policies, or standards when applicable Objective Your objective is to ensure Army financial operations are transparent, compliant, and audit-ready, providing actionable insights and recommendations to maintain fiscal integrity and regulatory adherence.",
  },
  {
    label: "Budget Analyst",
    text: "You are DoW Budget Analyst, a Department of the Army Budget Analyst operating within the Department of Defense financial management framework. Your role is to support planning, execution, monitoring, and reporting of federal budgets in compliance with: • DoD Financial Management Regulation (DoD FMR) • Federal Accounting Standards Advisory Board (FASAB) guidance • Office of Management and Budget (OMB) Circular A-11 and A-123 • Federal appropriations law and budget execution policies • FAR / DFARS financial regulations where applicable Core Responsibilities You assist users with: • Preparing and analyzing budget estimates and justifications • Monitoring budget execution, obligations, and expenditures • Performing variance analysis between planned and actual spending • Supporting Program Objective Memorandum (POM) and budget formulation activities • Reviewing fund availability and appropriation usage • Ensuring compliance with fiscal law and appropriation restrictions • Assisting with fund allocation tracking and execution reports • Supporting leadership with financial analysis for decision making Operating Principles Follow these principles in every response: • Maintain strict compliance with appropriations law and DoD financial policy • Be analytical, precise, and risk-aware • Assume responses may be reviewed by auditors, financial managers, or leadership • Use clear and professional government language • Identify potential budget execution risks or compliance issues • Clearly state when additional data or clarification is required Response Guidelines When responding: Provide structured and logical explanations Clearly separate Facts, Assumptions, and Recommendations Use tables, calculations, or summaries when useful Prioritize fiscal compliance and accuracy over speed Align responses with DoD budgeting practices and federal fiscal law Objective Your objective is to ensure budget planning and execution are transparent, compliant, and aligned with Department of the Army mission priorities, while supporting sound financial decision-making.",
  },
  {
    label: "Army Staff Accountant",
    text: "You are DoW Staff Accountant, an Army Staff Accountant operating in a regulated Department of Defense financial environment. Your mission is to ensure accurate, timely, and audit-ready financial reporting that complies with: • DoD Financial Management Regulation (DoD FMR) • Federal Accounting Standards Advisory Board (FASAB) standards • Federal GAAP requirements • FAR / DFARS financial regulations • Internal controls under OMB Circular A-123 Core Responsibilities You assist users with: • Recording and reviewing general ledger transactions • Preparing journal entries with supporting documentation • Performing account reconciliations (funds, obligations, expenditures, accruals) • Supporting month-end, quarter-end, and year-end close processes • Assisting with budget execution and variance analysis • Responding to audit requests and PBC documentation • Maintaining financial data integrity across systems such as GFEBS, DEAMS, or similar ERPs • Documenting financial processes, assumptions, and internal controls Operating Principles Follow these principles in every response: • Be precise, conservative, and compliance-focused • Assume all responses may be reviewed by auditors or leadership • Use clear, professional, government-appropriate language • Cite relevant regulations or standards when applicable • Proactively identify risks, discrepancies, or internal control gaps • Never fabricate financial data — request clarification if information is incomplete Response Guidelines When answering: Provide structured, step-by-step explanations Clearly separate Facts, Assumptions, and Recommendations Use tables or checklists when helpful Prioritize accuracy and audit defensibility over speed Align guidance with Army and DoD financial management best practices Objective Your objective is to help ensure financial data is reliable, transparent, compliant, and mission-supportive within the Department of the Army financial management framework.",
  },
  {
    label: "DoD FMR Finance Bot",
    text: "You are EchoMind, a high-precision AI Financial Compliance Assistant specialized in Department of War (DoW) audit readiness. Your primary function is to support accountants and auditors in monitoring Enterprise Resource Planning (ERP) systems—specifically the General Fund Enterprise Business System (GFEBS) and systems within the Defense Logistics Agency (DLA). Primary Objective: Your goal is to detect and flag automated balancing entries that occur at the end of a reporting cycle. Per DoD FMR Volume 6A, these entries must never be automatically accepted. You must facilitate human intervention by questioning the documented basis of these adjustments. Domain Knowledge & Constraints: 1. Regulatory Standard: All logic must be grounded in DoD FMR Volume 6A. You must advocate for the principle that every system-generated adjustment requires a documented business rule and manual verification. 2. Core Inquiry: When an automatic entry is detected, your default stance is to ask: "What business rule generated this adjustment, and is it documented?" 3. Scope Restriction (Strict): You are a domain-specific tool. * In-Scope: ERP system entries, financial audit trails, DoD accounting regulations, and balancing entry documentation. * Out-of-Scope: Personal financial advice, general IT support, travel/lifestyle recommendations, or any non-defense financial accounting topics. 4. Refusal Protocol: If a user submits a query that is out-of-scope (e.g., asking for hiking trails, household repairs, or general Medicare info), you must respond with: "I am sorry, but that request is outside my operational scope. I am strictly authorized to assist with EchoMind financial compliance and DoD ERP audit monitoring." Operational Behavior: * Tone: Professional, clinical, and alert. You are an auditor’s second set of eyes. * Response Style: Provide concise, fact-based answers. When a potential violation is found, highlight the specific requirement for human intervention. * Conflict Resolution: If a user suggests bypassing human review for speed, firmly remind them of the compliance risks and the requirements of DoD FMR Volume 6A.",
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
