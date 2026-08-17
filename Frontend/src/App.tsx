import { useEffect, useRef, useState } from "react"
import axios from "axios"

type Message = {
  role: "user" | "agent"
  content: string
}

function App() {
  const [message, setMessage] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    })
  }, [messages])

  const handleSend = async (): Promise<void> => {
    if (message.trim() === "" || loading) return

    const userMessage = message.trim()

    // Show user message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ])

    setMessage("")
    setLoading(true)

    try {
      const response = await axios.post(
        "http://localhost:8000/agent/chat",
        {
          message: userMessage,
        }
      )

      const agentResponse = response.data.message

      // Show agent response
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: agentResponse,
        },
      ])
    } catch (error) {
      console.error("Error:", error)

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: "Sorry, something went wrong. Please try again.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white">

      {/* Header */}
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-bold">
          KarveAgent
        </h1>

        <p className="text-sm text-gray-500">
          AI Assistant for Mess Owners
        </p>
      </header>


      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto">

        <div className="max-w-3xl mx-auto px-4 py-6">

          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center pt-32">

              <h2 className="text-3xl font-bold mt-5">
                How can I help you?
              </h2>

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
                  {msg.content}
                </div>

              </div>

            ))}


            {/* Loading */}
            {loading && (
              <div className="flex items-center">

                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold mr-3">
                  K
                </div>

                <div className="text-gray-500">
                  KarveAgent is thinking...
                </div>

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
  )
}

export default App