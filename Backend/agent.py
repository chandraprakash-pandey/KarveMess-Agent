from dotenv import load_dotenv
import os
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
import requests

load_dotenv()

SERVER_URL = os.getenv("SERVER_URL")

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
def get_todays_menu(day: str) -> str:
    """
    Get the mess today menu.
    """
    url = f"{SERVER_URL}/menu"

    response = requests.get(
        url,
    )

    if response is None:
        return f"Menu not found for {day}"

    response.raise_for_status()

    return response.text


# =========================
# AGENT
# =========================

agent = create_agent(
    model=llm,
    tools=[get_menu],
    system_prompt="""
You are KarveAgent, an AI assistant for mess owners.

Your job is to help the mess owner manage and retrieve
mess information.

Use the available tools whenever they are required.

Never invent menu information.
If the required information is not available through a tool,
clearly say that you don't have that information.
"""
)

response = agent.invoke({
    "messages": [
        {
            "role": "user",
            "content": "What is the menu for Monday?"
        }
    ]
})


print(response["messages"][-1].content)