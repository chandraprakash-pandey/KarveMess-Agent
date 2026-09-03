import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "agent";
  content: string;
};

type UserRole = "student" | "owner";

const AGENT_BASE_URL = "http://localhost:8000";
const OWNER_LOGIN_CHECK_URL = "http://localhost:8001/login";
const OWNER_LOGIN_PAGE_URL = "http://localhost:5173/login";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// --- KarveMess neo-brutalist design system (shared across the app) ---
const NEO_STYLES = `
  .neo-border {
    border: 3px solid #312e81;
  }
  .dot-pattern {
    background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .btn-lifted {
    transition: all 0.2s ease;
  }
  .btn-lifted:active {
    transform: translate(2px, 2px);
  }
  .shadow-neo-sm {
    box-shadow: 2px 2px 0px 0px #312e81;
  }
  .shadow-neo {
    box-shadow: 4px 4px 0px 0px #312e81;
  }
  .shadow-neo-lg {
    box-shadow: 6px 6px 0px 0px #312e81;
  }
  .bg-primary {
    background-color: #f87116;
  }
  .text-primary {
    color: #f87116;
  }
  .bg-indigo-custom {
    background-color: #312e81;
  }
  .text-indigo-custom {
    color: #312e81;
  }
  .bg-yellow-custom {
    background-color: #facc15;
  }
  .text-yellow-custom {
    color: #facc15;
  }
  .bg-background-light {
    background-color: #fffdf5;
  }
  .font-display {
    font-family: system-ui, -apple-system, sans-serif;
  }
  .border-t-3 {
    border-top-width: 3px;
  }

  @keyframes pulse-scale {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  @keyframes wiggle {
    0%, 100% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(-5deg);
    }
    75% {
      transform: rotate(5deg);
    }
  }

  .pulse-scale {
    animation: pulse-scale 2s ease-in-out infinite;
  }

  .wiggle {
    animation: wiggle 2s ease-in-out infinite;
  }
`;

function App() {
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [ownerGateMessage, setOwnerGateMessage] = useState<string>("");
  const [ownerButtonLoading, setOwnerButtonLoading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const isOwnerMode = selectedRole === "owner";

  const resetChatState = (): void => {
    setMessage("");
    setMessages([]);
  };

  const appendMessage = (role: Message["role"], content: string): void => {
    setMessages((prev) => [
      ...prev,
      {
        role,
        content,
      },
    ]);
  };

  const enterRole = (role: UserRole): void => {
    setSelectedRole(role);
    resetChatState();
    setOwnerGateMessage("");
  };

  const checkOwnerLogin = async (): Promise<boolean> => {
    const response = await axios.get(`${OWNER_LOGIN_CHECK_URL}?t=${Date.now()}`, {
      withCredentials: true,
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    console.log("Owner login check response: %o", response.data);

    return response.data?.isloggedin === true;
  };

  const waitForOwnerLogin = async (): Promise<void> => {
    while (true) {
      const isLoggedIn = await checkOwnerLogin();
      if (isLoggedIn) {
        return;
      }
      await sleep(2000);
    }
  };

  const handleSend = async (): Promise<void> => {
    if (message.trim() === "" || loading || !selectedRole) return;

    const userMessage = message.trim();

    // Show user message immediately
    appendMessage("user", userMessage);

    setMessage("");
    setLoading(true);

    try {
      const person = selectedRole === "owner" ? "owner" : "student";

      const response = await axios.post(`${AGENT_BASE_URL}/agent/${person}/chat`, {
        message: userMessage,
      }, {
        withCredentials: true,
      });

      const agentResponse = response.data.message;

      // Show agent response
      appendMessage("agent", agentResponse);
    } catch (error) {
      console.error("Error:", error);

      appendMessage("agent", "Sorry, something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStudentRole = (): void => {
    enterRole("student");
  };

  const handleOwnerRole = async (): Promise<void> => {
    if (ownerButtonLoading) return;

    setOwnerButtonLoading(true);
    setOwnerGateMessage("Checking owner login status...");

    try {
      const isLoggedIn = await checkOwnerLogin();

      if (isLoggedIn) {
        enterRole("owner");
        return;
      }

      setOwnerGateMessage("Owner is not logged in. Opened login page and waiting for confirmation...");
      window.open(OWNER_LOGIN_PAGE_URL, "_blank", "noopener,noreferrer");

      await waitForOwnerLogin();

      enterRole("owner");
    } catch (error) {
      console.error("Owner login check failed:", error);
      setOwnerGateMessage("Could not verify owner login right now. Please try again.");
    } finally {
      setOwnerButtonLoading(false);
    }
  };

  const handleBackToRoleSelection = (): void => {
    setSelectedRole(null);
    resetChatState();
    setOwnerGateMessage("");
    setOwnerButtonLoading(false);
  };

  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-background-light dot-pattern font-display flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-3xl rounded-3xl bg-white neo-border shadow-neo-lg p-8 md:p-12">
          <p className="text-xs font-black tracking-[0.24em] uppercase text-primary">
            Access Lock
          </p>

          <h1 className="mt-3 text-3xl md:text-4xl font-black text-indigo-custom leading-tight uppercase tracking-tight">
            Choose how you want to enter KarveAgent
          </h1>

          <p className="mt-4 text-indigo-custom/70 font-bold text-base md:text-lg">
            Student opens student chat directly. Owner requires login verification before opening owner chat.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <button
              onClick={handleStudentRole}
              className="btn-lifted rounded-2xl px-6 py-5 text-left bg-indigo-custom text-white neo-border shadow-neo hover:bg-primary transition-colors"
            >
              <div className="text-lg font-black uppercase tracking-wide">Use Agent as Student</div>

              <div className="text-sm text-white/80 mt-1 font-bold">
                Opens the student assistant you already built.
              </div>
            </button>

            <button
              onClick={handleOwnerRole}
              disabled={ownerButtonLoading}
              className="btn-lifted rounded-2xl px-6 py-5 text-left bg-yellow-custom text-indigo-custom neo-border shadow-neo hover:bg-primary hover:text-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="text-lg font-black uppercase tracking-wide">Use Agent as Mess Owner</div>

              <div className="text-sm mt-1 font-bold">
                {ownerButtonLoading ? "Checking login..." : "Checks login and opens owner chat."}
              </div>
            </button>
          </div>

          {ownerGateMessage !== "" && (
            <div className="mt-6 rounded-xl neo-border bg-yellow-custom/20 px-4 py-3 text-indigo-custom font-bold">
              {ownerGateMessage}
            </div>
          )}
        </div>

        <style>{NEO_STYLES}</style>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white font-display">
      {/* Header */}
      <header className={
        isOwnerMode
          ? "border-b-4 border-yellow-custom px-6 py-4 flex items-center justify-between gap-4 bg-background-light dot-pattern"
          : "border-b-4 border-indigo-custom px-6 py-4 flex items-center justify-between gap-4 bg-background-light dot-pattern"
      }>
        <div className="flex items-center gap-3">
          <div className={
            isOwnerMode
              ? "size-10 bg-yellow-custom neo-border rounded-xl flex items-center justify-center shadow-neo shrink-0"
              : "size-10 bg-primary neo-border rounded-xl flex items-center justify-center shadow-neo shrink-0"
          }>
            <span className={isOwnerMode ? "text-indigo-custom font-black text-lg" : "text-white font-black text-lg"}>
              {isOwnerMode ? "O" : "K"}
            </span>
          </div>

          <div>
            <h1 className="text-xl font-black text-indigo-custom uppercase tracking-tight">KarveAgent</h1>

            <p className="text-sm text-indigo-custom/60 font-bold">
              {isOwnerMode ? "AI Assistant for Mess Owners" : "AI Assistant for Students"}
            </p>
          </div>
        </div>

        <button
          onClick={handleBackToRoleSelection}
          className="btn-lifted text-xs font-black uppercase tracking-wide px-3 py-2 rounded-lg neo-border bg-white text-indigo-custom hover:bg-primary hover:text-white shadow-neo-sm transition-colors"
        >
          Change Role
        </button>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center pt-32">
              <div className={
                isOwnerMode
                  ? "size-16 bg-yellow-custom neo-border rounded-2xl flex items-center justify-center shadow-neo pulse-scale mb-5"
                  : "size-16 bg-primary neo-border rounded-2xl flex items-center justify-center shadow-neo pulse-scale mb-5"
              }>
                <span className={isOwnerMode ? "text-indigo-custom font-black text-2xl" : "text-white font-black text-2xl"}>
                  {isOwnerMode ? "O" : "K"}
                </span>
              </div>

              <h2 className="text-3xl font-black text-indigo-custom uppercase tracking-tight mt-5">How can I help you?</h2>

              <p className="text-indigo-custom/60 font-bold mt-2">
                Ask me anything about your mess.
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={
                  msg.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                {msg.role === "agent" && (
                  <div
                    className={
                      isOwnerMode
                        ? "w-8 h-8 flex-shrink-0 bg-yellow-custom text-indigo-custom neo-border shadow-neo-sm rounded-lg flex items-center justify-center font-black mr-3"
                        : "w-8 h-8 flex-shrink-0 bg-primary text-white neo-border shadow-neo-sm rounded-lg flex items-center justify-center font-black mr-3"
                    }
                  >
                    {isOwnerMode ? "O" : "K"}
                  </div>
                )}

                <div
                  className={
                    msg.role === "user"
                      ? "max-w-xl bg-indigo-custom text-white px-4 py-3 rounded-2xl neo-border shadow-neo-sm font-bold"
                      : "max-w-xl px-1 py-3 text-indigo-custom"
                  }
                >
                  {msg.role === "agent" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex items-center">
                <div
                  className={
                    isOwnerMode
                      ? "w-8 h-8 bg-yellow-custom text-indigo-custom neo-border shadow-neo-sm rounded-lg flex items-center justify-center font-black mr-3"
                      : "w-8 h-8 bg-primary text-white neo-border shadow-neo-sm rounded-lg flex items-center justify-center font-black mr-3"
                  }
                >
                  {isOwnerMode ? "O" : "K"}
                </div>

                <div className="text-indigo-custom/60 font-bold">KarveAgent is thinking...</div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className={
        isOwnerMode
          ? "border-t-4 border-yellow-custom bg-background-light dot-pattern p-4"
          : "border-t-4 border-indigo-custom bg-background-light dot-pattern p-4"
      }>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-white neo-border rounded-2xl p-2 shadow-neo">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isOwnerMode ? "Message Owner Agent..." : "Message KarveAgent..."}
              rows={1}
              disabled={loading}
              className="flex-1 resize-none outline-none px-3 py-2 font-bold text-indigo-custom placeholder:text-indigo-custom/40 placeholder:font-bold bg-transparent"
            />

            <button
              onClick={handleSend}
              disabled={loading || message.trim() === ""}
              className={
                isOwnerMode
                  ? "btn-lifted bg-yellow-custom text-indigo-custom neo-border shadow-neo-sm font-black px-4 py-2 rounded-xl disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed transition-colors"
                  : "btn-lifted bg-primary text-white neo-border shadow-neo-sm font-black px-4 py-2 rounded-xl disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed transition-colors"
              }
            >
              ↑
            </button>
          </div>

          <p className="text-center text-xs text-indigo-custom/50 font-bold uppercase tracking-wide mt-2">
            {isOwnerMode
              ? "Owner Agent can access your owner profile tools."
              : "KarveAgent can access and manage your mess data."}
          </p>
        </div>
      </div>

      <style>{NEO_STYLES}</style>
    </div>
  );
}

export default App;