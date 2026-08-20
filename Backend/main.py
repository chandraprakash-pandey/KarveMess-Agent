from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import chat_with_history, chat_with_mess_owner_history, set_owner_cookie_header

app = FastAPI()

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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


@app.post("/agent/student/chat")
def chat(request: ChatRequest):
    print("User:", request.message)

    answer = chat_with_history(request.message)

    return {
        "message": answer
    }


@app.post("/agent/owner/chat")
def mess_owner_chat(request: ChatRequest, raw_request: Request):
    print("Mess Owner:", request.message)

    set_owner_cookie_header(raw_request.headers.get("cookie", ""))
    answer = chat_with_mess_owner_history(request.message)
    set_owner_cookie_header("")

    return {
        "message": answer
    }