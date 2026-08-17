from agent import agent


response = agent.invoke({
    "messages": [
        {
            "role": "user",
            "content": "What is the menu for Monday?"
        }
    ]
})


print(response["messages"][-1].content)