from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import agent

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

    response = agent.invoke({
        "messages": [
            {
                "role": "user",
                "content": request.message
            }
        ]
    })

    answer = response["messages"][-1].content

    return {
        "message": answer
    }