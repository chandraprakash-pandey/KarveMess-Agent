from dotenv import load_dotenv
import os
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
import requests

load_dotenv()

SERVER_URL = os.getenv("SERVER_URL")

SYSTEM_PROMPT_STUDENT = """
You are KarveAgent, an AI assistant for students.

Your job is to help students access and retrieve
mess information and Menu Items.

Use the available tools whenever they are required.

Never invent menu information.
If the required information is not available through a tool,
clearly say that you don't have that information.
"""

# Chat history for the current session
messages = [
    {
        "role": "system",
        "content": SYSTEM_PROMPT_STUDENT,
    }
]

# =========================
# LLM
# =========================

llm = ChatOpenAI(
    model="gpt-5.4-nano",
)


# =========================
# TOOL
# =========================

@tool
def get_todays_menu() -> str:
    """
    Fetch today's mess menu from the KarveMess backend for students.

    Use this tool for queries about today's:
    - Breakfast
    - Lunch
    - Dinner
    - Mess menu
    - Available food/items

    Return only:
    - Mess name
    - Mess Address
    - Item name
    - Item price
    With Friendly way with Student.

    Do not include ChefId or any other backend/internal fields.

    Do not use this tool for past or future dates.
    """
    url = f"{SERVER_URL}/menu"

    response = requests.get(
        url,
    )

    if response.status_code == 404:
        return f"No Mess Owner added Menu today!!"

    response.raise_for_status()

    return response.text


# =========================
# AGENT
# =========================

student_agent = create_agent(
    model=llm,
    tools=[get_todays_menu],
    system_prompt=SYSTEM_PROMPT_STUDENT,
)


def chat_with_history(user_message: str) -> str:
    """Store the chat history and get the agent response for one message."""
    if not user_message or not user_message.strip():
        return "Please enter a valid message."

    messages.append({
        "role": "user",
        "content": user_message,
    })

    response = student_agent.invoke({
        "messages": messages,
    })

    ai_message = response["messages"][-1].content

    messages.append({
        "role": "ai",
        "content": ai_message,
    })

    return ai_message
