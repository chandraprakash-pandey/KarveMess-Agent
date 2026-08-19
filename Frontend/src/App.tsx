import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "agent";
  content: string;
};

type UserRole = "student" | "mess-owner";

function App() {
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [ownerDemoNote, setOwnerDemoNote] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async (): Promise<void> => {
    if (message.trim() === "" || loading) return;

    const userMessage = message.trim();

    // Show user message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post("http://localhost:8000/agent/chat", {
        message: userMessage,
      });

      const agentResponse = response.data.message;

      // Show agent response
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: agentResponse,
        },
      ]);
    } catch (error) {
      console.error("Error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
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
    setSelectedRole("student");
    setOwnerDemoNote("");
  };

  const handleOwnerDemo = (): void => {
    setOwnerDemoNote("Mess Owner mode is coming soon. This is a demo button for now.");
  };

  const handleBackToRoleSelection = (): void => {
    setSelectedRole(null);
  };

  if (selectedRole !== "student") {
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
            Select Student to use your current agent chat. Mess Owner is a demo button for now.
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
              onClick={handleOwnerDemo}
              className="rounded-2xl px-6 py-5 text-left bg-orange-100 text-orange-900 border border-orange-300 hover:bg-orange-200 transition-colors"
            >
              <div className="text-lg font-semibold">Use Agent as Mess Owner</div>

              <div className="text-sm text-orange-800 mt-1">
                Demo button only.
              </div>
            </button>
          </div>

          {ownerDemoNote !== "" && (
            <div className="mt-6 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-orange-900">
              {ownerDemoNote}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">KarveAgent</h1>

          <p className="text-sm text-gray-500">AI Assistant for Students</p>
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
                  <div className="w-8 h-8 flex-shrink-0 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold mr-3">
                    K
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
                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold mr-3">
                  K
                </div>

                <div className="text-gray-500">KarveAgent is thinking...</div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 border border-gray-300 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message KarveAgent..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none outline-none px-3 py-2"
            />

            <button
              onClick={handleSend}
              disabled={loading || message.trim() === ""}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              ↑
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-2">
            KarveAgent can access and manage your mess data.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
