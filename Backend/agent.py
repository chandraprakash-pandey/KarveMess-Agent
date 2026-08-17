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
def get_todays_menu() -> str:
    """
    Fetch the mess menu for today from the KarveMess backend.

    Use this tool when the user asks about:
    - Today's breakfast, lunch, or dinner
    - Today's mess menu
    - What is being served today
    - What food is available today

    This tool retrieves the latest menu configured by the Mess Owner.
    Do not use this tool for menus of previous or future dates.
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

agent = create_agent(
    model=llm,
    tools=[get_todays_menu],
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
