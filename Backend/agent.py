from dotenv import load_dotenv
import os
from contextvars import ContextVar
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
import requests

load_dotenv()

SERVER_URL = os.getenv("SERVER_URL")
OWNER_COOKIE_HEADER: ContextVar[str] = ContextVar("owner_cookie_header", default="")


def set_owner_cookie_header(cookie_header: str) -> None:
    OWNER_COOKIE_HEADER.set(cookie_header or "")

SYSTEM_PROMPT_STUDENT = """
You are KarveAgent, an AI assistant for students.

Your job is to help students access and retrieve
mess information and Menu Items.

Use the available tools whenever they are required.

Never invent menu information.
If the required information is not available through a tool,
clearly say that you don't have that information.
"""

SYSTEM_PROMPT_MESS_OWNER = """
You are KarveAgent, an AI assistant for mess owners.

Your job is to help mess owners access and manage
their personal profile details and mess information.

Use the available tools whenever they are required.

Never invent personal details.
If the required information is not available through a tool,
clearly say that you don't have that information.

When the owner wants to change a menu, use the change_owner_menu tool.
Before calling it, make sure you have:
- The day of the menu to change.
- At least one item name.
- A price for every item name.

If the owner forgets the day, ask for the day.
If an item name is missing, ask for the item name.
If a price is missing, ask for the price.
Never guess an item name, day, or price.

The menu-change tool is currently a demo and does not update backend data.
"""



# Chat history for the current session
messages_students = [
    {
        "role": "system",
        "content": SYSTEM_PROMPT_STUDENT,
    }
]

messages_mess_owner = [
    {
        "role": "system",
        "content": SYSTEM_PROMPT_MESS_OWNER,
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

    try:
        response = requests.get(url, timeout=10)

        if response.status_code == 404:
            return "No Mess Owner added Menu today!!"

        response.raise_for_status()
        return response.text
    except requests.RequestException:
        return "Unable to fetch today's menu right now. Please try again later."


@tool
def get_mess_owner_personal_data() -> str:
    """
    Fetch mess owner personal data.

    Use this tool when the mess owner asks about:
    - Personal profile data
    - Name, contact, or account details
    - Their owner information

    This tool sends a GET request to the specified URL.
    """

    url = f"{SERVER_URL}/user"

    try:
        print("Url:", url)

        cookie_header = OWNER_COOKIE_HEADER.get()
        headers = {
            "Accept": "application/json",
        }
        if cookie_header:
            headers["Cookie"] = cookie_header

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 404:
            print("Mess owner personal data was not found.")
            return "Mess owner personal data was not found."

        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print("helllllo")
        print("Error fetching owner personal data:", e)
        return "Unable to fetch owner personal data right now. Please try again later."


@tool
def get_owner_menus() -> str:
    """
    Fetch the mess owner's menu items.

    Use this tool when the mess owner asks about:
    - Their menu items
    - Items they have added
    - Their menu prices
    - Their mess menu configuration

    This tool sends an authenticated GET request to /myItems.
    """
    url = f"{SERVER_URL}/myItems"

    try:
        print("Url:", url)

        cookie_header = OWNER_COOKIE_HEADER.get()
        headers = {
            "Accept": "application/json",
        }
        if cookie_header:
            headers["Cookie"] = cookie_header

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 404:
            return "No menu items were found for this mess owner."

        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print("Error fetching owner menus:", e)
        return "Unable to fetch owner menus right now. Please try again later."


@tool
def change_owner_menu(day: str, items_and_prices: dict[str, float]) -> str:
    """
    Demo tool for changing a mess owner's menu for a specific day.

    Args:
        day: The day whose menu should be changed, such as Monday.
        items_and_prices: A map where each item name is a key and its price
            is the numeric value, such as {"Poha": 40, "Tea": 15}.

    This is currently a demo and does not update the backend.
    """
    if not day or not day.strip():
        return "Please provide the day for which you want to change the menu."

    if not items_and_prices:
        return "Please provide at least one menu item and its price."

    invalid_items = [
        item_name
        for item_name, price in items_and_prices.items()
        if not item_name.strip() or price < 0
    ]
    if invalid_items:
        return "Each menu item needs a name and a valid non-negative price."

    menu_lines = [
        f"- {item_name}: {price}"
        for item_name, price in items_and_prices.items()
    ]

    return (
        "Demo only: the menu was not changed in the backend.\n"
        f"Requested day: {day.strip()}\n"
        "Requested items and prices:\n"
        + "\n".join(menu_lines)
    )


# =========================
# AGENT
# =========================

student_agent = create_agent(
    model=llm,
    tools=[get_todays_menu],
    system_prompt=SYSTEM_PROMPT_STUDENT,
)

mess_owner_agent = create_agent(
    model=llm,
    tools=[get_mess_owner_personal_data, get_owner_menus, change_owner_menu],
    system_prompt=SYSTEM_PROMPT_MESS_OWNER,
)


def chat_with_history(user_message: str) -> str:
    """Store the chat history and get the agent response for one message."""
    if not user_message or not user_message.strip():
        return "Please enter a valid message."

    messages_students.append({
        "role": "user",
        "content": user_message,
    })

    try:
        response = student_agent.invoke({
            "messages": messages_students,
        })

        ai_message = response["messages"][-1].content
    except Exception:
        ai_message = "I couldn't process your request right now. Please try again in a moment."

    messages_students.append({
        "role": "ai",
        "content": ai_message,
    })

    return ai_message


def chat_with_mess_owner_history(user_message: str) -> str:
    """Store mess-owner chat history and return the agent response."""
    
    if not user_message or not user_message.strip():
        return "Please enter a valid message."

    messages_mess_owner.append({
        "role": "user",
        "content": user_message,
    })

    try:
        response = mess_owner_agent.invoke({
            "messages": messages_mess_owner,
        })

        ai_message = response["messages"][-1].content
    except Exception:
        ai_message = "I couldn't process your owner request right now. Please try again in a moment."

    messages_mess_owner.append({
        "role": "ai",
        "content": ai_message,
    })

    return ai_message
