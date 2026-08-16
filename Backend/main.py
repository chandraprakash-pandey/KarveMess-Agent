from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

    return {
        "message": f"Backend received: {request.message}"
    }