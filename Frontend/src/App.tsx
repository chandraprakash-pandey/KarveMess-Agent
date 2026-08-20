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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-700 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-3xl rounded-3xl bg-white/95 p-8 md:p-12 shadow-2xl border border-white/50 backdrop-blur">
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-orange-600">
            Access Lock
          </p>

          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Choose how you want to enter KarveAgent
          </h1>

          <p className="mt-4 text-slate-600 text-base md:text-lg">
            Student opens student chat directly. Owner requires login verification before opening owner chat.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <button
              onClick={handleStudentRole}
              className="rounded-2xl px-6 py-5 text-left bg-slate-900 text-white hover:bg-slate-700 transition-colors"
            >
              <div className="text-lg font-semibold">Use Agent as Student</div>

              <div className="text-sm text-slate-300 mt-1">
                Opens the student assistant you already built.
              </div>
            </button>

            <button
              onClick={handleOwnerRole}
              disabled={ownerButtonLoading}
              className="rounded-2xl px-6 py-5 text-left bg-orange-100 text-orange-900 border border-orange-300 hover:bg-orange-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="text-lg font-semibold">Use Agent as Mess Owner</div>

              <div className="text-sm text-orange-800 mt-1">
                {ownerButtonLoading ? "Checking login..." : "Checks login and opens owner chat."}
              </div>
            </button>
          </div>

          {ownerGateMessage !== "" && (
            <div className="mt-6 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-orange-900">
              {ownerGateMessage}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={isOwnerMode ? "h-screen flex flex-col bg-orange-50" : "h-screen flex flex-col bg-white"}>
      {/* Header */}
      <header className={isOwnerMode ? "border-b border-orange-200 px-6 py-4 flex items-center justify-between gap-4 bg-orange-100" : "border-b px-6 py-4 flex items-center justify-between gap-4"}>
        <div>
          <h1 className="text-xl font-bold">KarveAgent</h1>

          <p className="text-sm text-gray-500">
            {isOwnerMode ? "AI Assistant for Mess Owners" : "AI Assistant for Students"}
          </p>
        </div>

        <button
          onClick={handleBackToRoleSelection}
          className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
        >
          Change Role
        </button>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center pt-32">
              <h2 className="text-3xl font-bold mt-5">How can I help you?</h2>

              <p className="text-gray-500 mt-2">
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
                        ? "w-8 h-8 flex-shrink-0 bg-orange-600 text-white rounded-lg flex items-center justify-center font-bold mr-3"
                        : "w-8 h-8 flex-shrink-0 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold mr-3"
                    }
                  >
                    {isOwnerMode ? "O" : "K"}
                  </div>
                )}

                <div
                  className={
                    msg.role === "user"
                      ? "max-w-xl bg-gray-100 px-4 py-3 rounded-2xl"
                      : "max-w-xl px-1 py-3"
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
                      ? "w-8 h-8 bg-orange-600 text-white rounded-lg flex items-center justify-center font-bold mr-3"
                      : "w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold mr-3"
                  }
                >
                  {isOwnerMode ? "O" : "K"}
                </div>

                <div className="text-gray-500">KarveAgent is thinking...</div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className={isOwnerMode ? "border-t border-orange-200 bg-orange-50 p-4" : "border-t bg-white p-4"}>
        <div className="max-w-3xl mx-auto">
          <div
            className={
              isOwnerMode
                ? "flex items-end gap-2 border border-orange-300 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-orange-500"
                : "flex items-end gap-2 border border-gray-300 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500"
            }
          >
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isOwnerMode ? "Message Owner Agent..." : "Message KarveAgent..."}
              rows={1}
              disabled={loading}
              className="flex-1 resize-none outline-none px-3 py-2"
            />

            <button
              onClick={handleSend}
              disabled={loading || message.trim() === ""}
              className={
                isOwnerMode
                  ? "bg-orange-600 text-white px-4 py-2 rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                  : "bg-blue-600 text-white px-4 py-2 rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
              }
            >
              ↑
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-2">
            {isOwnerMode
              ? "Owner Agent can access your owner profile tools."
              : "KarveAgent can access and manage your mess data."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
