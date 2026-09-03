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

**IMPORTANT - MENU EDITING WORKFLOW:**
When the owner wants to edit an existing menu item, ALWAYS follow these steps:
1. First, use get_owner_menus to find the menu item ID
2. Then, use preview_menu_edit with the menu ID and requested changes to show what will change
3. Wait for the owner to confirm the changes
4. Only after owner confirmation, use edit_owner_menu_item with the same parameters to apply the changes

The tool can edit existing items, add new items, and delete items from the same menu update. 
Never guess a menu item ID - always fetch it first.
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

    Do not use this tool for past or future dates.
    """
    url = f"{SERVER_URL}/menu"

    try:
        response = requests.get(url, timeout=10)

        if response.status_code == 404:
            return "No Mess Owner added Menu today!!"

        response.raise_for_status()
        print("Response:", response.text)
        
        # Parse the response and extract only required fields
        data = response.json()
        
        if isinstance(data, list):
            filtered_menus = []
            for mess in data:
                chef_info = mess.get("chefId", {})
                filtered_menu = {
                    "fullName": chef_info.get("fullName"),
                    "messName": chef_info.get("messName"),
                    "messAddress": chef_info.get("messAddress"),
                    "item": mess.get("item"),
                    "day": mess.get("day"),
                }
                filtered_menus.append(filtered_menu)
            
            import json
            print("Filtered Menus:", json.dumps(filtered_menus, indent=2))
            return json.dumps(filtered_menus, indent=2)
        else:
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
def preview_menu_edit(
    item_id: str,
    item_and_price: dict[str, float] | None = None,
    items_to_add: dict[str, float] | None = None,
    items_to_delete: list[str] | None = None,
) -> str:
    """
    Preview menu changes before applying them. Shows what will be edited, added, or deleted.
    
    IMPORTANT: Always use this tool FIRST before calling edit_owner_menu_item .
    
    Args:
        item_id: The menu item ID returned by get_owner_menus.
        item_and_price: Optional map of existing item name to new price,
            such as {"Poha": 50}.
        items_to_add: Optional map of new item name to price,
            such as {"Masala Dosa": 90}.
        items_to_delete: Optional list of item names to remove,
            such as ["Tea"].
    
    Returns a summary of changes without applying them. After owner confirms,
    use edit_owner_menu_item with the same parameters to apply the changes.
    """
    if not item_id or not item_id.strip():
        return "Please provide the menu item ID to preview."

    item_and_price = item_and_price or {}
    items_to_add = items_to_add or {}
    items_to_delete = items_to_delete or []

    if not item_and_price and not items_to_add and not items_to_delete:
        return "Please provide changes to preview (edit, add, or delete items)."

    # Validate input
    requested_prices = {**item_and_price, **items_to_add}
    for item_name, price in requested_prices.items():
        if not item_name or not item_name.strip():
            return "Every menu item must have a name."
        if not isinstance(price, (int, float)) or isinstance(price, bool) or price < 0:
            return f"Please provide a valid non-negative price for {item_name}."

    if any(not item_name or not item_name.strip() for item_name in items_to_delete):
        return "Every item to delete must have a name."

    try:
        # Fetch current menu to show what exists
        cookie_header = OWNER_COOKIE_HEADER.get()
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if cookie_header:
            headers["Cookie"] = cookie_header

        menus_url = f"{SERVER_URL}/myItems"
        menus_response = requests.get(menus_url, headers=headers, timeout=10)
        menus_response.raise_for_status()
        menus_data = menus_response.json()

        if isinstance(menus_data, list):
            menu_records = menus_data
        elif isinstance(menus_data, dict):
            menu_records = menus_data.get("items", menus_data.get("data", [menus_data]))
        else:
            return "Unable to fetch current menu for preview."

        menu_record = next(
            (record for record in menu_records if str(record.get("_id", record.get("id", ""))) == item_id.strip()),
            None,
        )

        if not menu_record or not isinstance(menu_record.get("item"), dict):
            return "The requested menu item was not found."

        current_items = menu_record["item"]

        # Build summary
        summary = "📋 **MENU CHANGE PREVIEW** 📋\n\n"
        
        if item_and_price:
            summary += "**Items to Update:**\n"
            for item_name, new_price in item_and_price.items():
                old_price = current_items.get(item_name.strip(), "N/A")
                summary += f"  • {item_name.strip()}: ₹{old_price} → ₹{new_price}\n"
            summary += "\n"

        if items_to_add:
            summary += "**Items to Add:**\n"
            for item_name, price in items_to_add.items():
                summary += f"  • {item_name.strip()}: ₹{price} (new)\n"
            summary += "\n"

        if items_to_delete:
            summary += "**Items to Delete:**\n"
            for item_name in items_to_delete:
                price = current_items.get(item_name.strip(), "N/A")
                summary += f"  • {item_name.strip()}: ₹{price}\n"
            summary += "\n"

        summary += "✅ **Please confirm these changes by saying 'yes' or 'confirm'.**"
        
        return summary

    except requests.RequestException as e:
        print("Error previewing menu changes:", e)
        return "Unable to preview menu changes right now. Please try again later."


@tool
def edit_owner_menu_item(
    item_id: str,
    item_and_price: dict[str, float] | None = None,
    items_to_add: dict[str, float] | None = None,
    items_to_delete: list[str] | None = None,
) -> str:
    """
    Update an owner's complete menu map using its menu document ID.
    
    IMPORTANT: Always call preview_menu_edit FIRST to show the owner what changes will be made.

    Args:
        item_id: The menu item ID returned by get_owner_menus.
        item_and_price: Optional map of existing item name to new price,
            such as {"Poha": 50}.
        items_to_add: Optional map of new item name to price,
            such as {"Masala Dosa": 90}.
        items_to_delete: Optional list of item names to remove,
            such as ["Tea"].

    Fetches the current item map, applies all requested changes, and sends the
    complete map to /editItem/{item_id}. The deployed backend replaces the
    entire item map during PATCH, so the full map must be sent.
    """
    if not item_id or not item_id.strip():
        return "Please provide the menu item ID to edit."

    item_and_price = item_and_price or {}
    items_to_add = items_to_add or {}
    items_to_delete = items_to_delete or []

    if not item_and_price and not items_to_add and not items_to_delete:
        return "Please provide an item to edit, add, or delete."

    requested_prices = {**item_and_price, **items_to_add}
    for item_name, price in requested_prices.items():
        if not item_name or not item_name.strip():
            return "Every menu item must have a name."
        if not isinstance(price, (int, float)) or isinstance(price, bool) or price < 0:
            return f"Please provide a valid non-negative price for {item_name}."

    if any(not item_name or not item_name.strip() for item_name in items_to_delete):
        return "Every item to delete must have a name."

    try:
        cookie_header = OWNER_COOKIE_HEADER.get()
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if cookie_header:
            headers["Cookie"] = cookie_header

        menus_url = f"{SERVER_URL}/myItems"
        print("Url:", menus_url)

        menus_response = requests.get(
            menus_url,
            headers=headers,
            timeout=10,
        )
        menus_response.raise_for_status()
        menus_data = menus_response.json()

        if isinstance(menus_data, list):
            menu_records = menus_data
        elif isinstance(menus_data, dict):
            menu_records = menus_data.get("items", menus_data.get("data", [menus_data]))
        else:
            return "The owner menu response has an invalid format."

        if not isinstance(menu_records, list):
            return "The owner menu response has an invalid format."

        menu_record = next(
            (
                record
                for record in menu_records
                if str(record.get("_id", record.get("id", ""))) == item_id.strip()
            ),
            None,
        )

        if not menu_record or not isinstance(menu_record.get("item"), dict):
            return "The requested menu item was not found or has an invalid format."

        complete_item_map = dict(menu_record["item"])

        for item_name, price in item_and_price.items():
            complete_item_map[item_name.strip()] = price

        for item_name, price in items_to_add.items():
            complete_item_map[item_name.strip()] = price

        for item_name in items_to_delete:
            complete_item_map.pop(item_name.strip(), None)

        url = f"{SERVER_URL}/editItem/{item_id.strip()}"
        payload = {
            "item": complete_item_map,
        }
        print("Url:", url)

        response = requests.patch(
            url,
            json=payload,
            headers=headers,
            timeout=10,
        )

        if response.status_code == 404:
            return "The requested menu item was not found."

        response.raise_for_status()
        return "✅ Menu item updated successfully! Changes have been applied."
    except (requests.RequestException, ValueError) as e:
        print("Error editing owner menu item:", e)
        return "Unable to edit the owner menu item right now. Please try again later."


@tool
def delete_owner_menu_card(item_id: str) -> str:
    """
    Delete a mess owner's complete menu card for a specific day.

    Use this tool when the mess owner wants to:
    - Delete an entire menu card
    - Remove all items from a specific day's menu
    - Remove a menu record completely

    Args:
        item_id: The menu item ID (from get_owner_menus response _id field)

    This tool sends a DELETE request to /editItem/{item_id}.
    First use get_owner_menus to get the list of menu IDs.
    """
    if not item_id or not item_id.strip():
        return "Please provide the menu item ID to delete."

    try:
        cookie_header = OWNER_COOKIE_HEADER.get()
        headers = {
            "Accept": "application/json",
        }
        if cookie_header:
            headers["Cookie"] = cookie_header

        url = f"{SERVER_URL}/editItem/{item_id.strip()}"
        print("Url:", url)

        response = requests.delete(
            url,
            headers=headers,
            timeout=10,
        )

        if response.status_code == 404:
            return "The requested menu card was not found."

        response.raise_for_status()
        return "✅ Menu card deleted successfully!"
    except requests.RequestException as e:
        print("Error deleting owner menu card:", e)
        return "Unable to delete the menu card right now. Please try again later."


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
        preview_menu_edit,
        edit_owner_menu_item,
        delete_owner_menu_card,
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
