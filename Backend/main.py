from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import chat_with_history, chat_with_mess_owner_history

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def home():
    return {
        "message": "KarveAgent Backend is running"
    }


@app.post("/agent/chat")
def chat(request: ChatRequest):
    print("User:", request.message)

    answer = chat_with_history(request.message)

    return {
        "message": answer
    }


@app.post("/agent/mess-owner/chat")
def mess_owner_chat(request: ChatRequest):
    print("Mess Owner:", request.message)

    answer = chat_with_mess_owner_history(request.message)

    return {
        "message": answer
    }