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

When the owner wants to edit an existing menu item, first use get_owner_menus
to find its menu item ID. Then use edit_owner_menu_item with that ID and the
requested item name and price. Never guess a menu item ID.
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
def edit_owner_menu_item(item_id: str, item_and_price: dict[str, float]) -> str:
    """
    Edit an existing owner menu item using its menu item ID.

    Args:
        item_id: The menu item ID returned by get_owner_menus.
        item_and_price: A one-entry map with the item name as key and its
            numeric price as value, such as {"Poha": 50}.

    Sends a PATCH request to /editItem/{item_id} with this body shape:
    {"item": {"Poha": 50}}.
    """
    if not item_id or not item_id.strip():
        return "Please provide the menu item ID to edit."

    if not item_and_price:
        return "Please provide the item name and price."

    if len(item_and_price) != 1:
        return "Please provide exactly one item name and price for this menu item."

    item_name, price = next(iter(item_and_price.items()))
    if not item_name.strip():
        return "Please provide the menu item name."

    if price < 0:
        return "Please provide a valid non-negative price."

    url = f"{SERVER_URL}/editItem/{item_id.strip()}"
    payload = {
        "item": {
            item_name.strip(): price,
        },
    }

    try:
        print("Url:", url)

        cookie_header = OWNER_COOKIE_HEADER.get()
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if cookie_header:
            headers["Cookie"] = cookie_header

        response = requests.patch(
            url,
            json=payload,
            headers=headers,
            timeout=10,
        )

        if response.status_code == 404:
            return "The requested menu item was not found."

        response.raise_for_status()
        return response.text or "Menu item updated successfully."
    except requests.RequestException as e:
        print("Error editing owner menu item:", e)
        return "Unable to edit the owner menu item right now. Please try again later."


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
    tools=[
        get_mess_owner_personal_data,
        get_owner_menus,
        edit_owner_menu_item,
    ],
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
