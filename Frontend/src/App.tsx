import { useState } from "react"
import axios from "axios"

function App() {
  const [message, setMessage] = useState<string>("")

  const handleSend = async (): Promise<void> => {
    if (message.trim() === "") return

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/agent/chat",
        {
          message: message,
        }
      )

      console.log("Backend Response:", response.data.message)

      setMessage("")
    } catch (error) {
      console.error("Error:", error)
    }
  }

  return (
    <div className="h-screen flex flex-col">

      <div className="flex-1 flex items-center justify-center">
        <h1 className="text-3xl font-bold">
          KarveAgent
        </h1>
      </div>

      <div className="border-t p-4">

        <div className="max-w-3xl mx-auto flex items-end gap-2 border rounded-2xl p-2">

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message KarveAgent..."
            rows={1}
            className="flex-1 resize-none outline-none px-3 py-2"
          />

          <button
            onClick={handleSend}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            ↑
          </button>

        </div>

      </div>

    </div>
  )
}

export default App