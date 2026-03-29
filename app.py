from __future__ import annotations

import logging
import os
from dotenv import load_dotenv

from agents import (
    Agent, 
    FileSearchTool, 
    Runner, 
    AsyncOpenAI, 
    set_default_openai_client, 
    set_tracing_disabled, 
    set_default_openai_api
)

# Load secrets once at start-up.
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("gemini_agent_cli")

# ==========================================
# GEMINI API / OPENAI SDK OVERRIDE CONFIG
# ==========================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
VECTOR_STORE_ID = os.getenv("OPENAI_VECTOR_STORE_ID", "vs_mock_id") 

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY is missing. Please set it in your environment or .env file.")

# Global override for the `agents` library
set_tracing_disabled(True)
set_default_openai_api("chat_completions")

external_client = AsyncOpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
set_default_openai_client(external_client)

# ==========================================
# AGENT SETUP
# ==========================================

# Include the FileSearchTool pointing to your managed vector store
file_tool = FileSearchTool(vector_store_ids=[VECTOR_STORE_ID], max_num_results=3, include_search_results=True)

assistant = Agent(
    name="LibraryGuide",
    instructions=(
        "You answer questions using the uploaded study notes. Use file_search to look for relevant notes and then answer. Do not self-invent facts."
        "Explain answers in short friendly sentences. If the notes do not contain the info, say that."
    ),
    model="gemini-2.5-flash",
    tools=[file_tool],
)

# ==========================================
# COMMAND LINE EXECUTION (No Chainlit)
# ==========================================

if __name__ == "__main__":
    print("Welcome to the Gemini-powered LibraryGuide.")
    print("Type 'exit' to quit.\n")
    
    while True:
        try:
            user_input = input("You: ")
            if user_input.lower() in ['exit', 'quit']:
                break
            
            if not user_input.strip():
                continue
                
            print("Assistant: Thinking...")
            
            # Using synchronous Runner.run as per your code snippet
            result = Runner.run_sync(assistant, user_input)
            
            answer = (result.final_output or "I did not find anything useful in the notes.").strip()
            print(f"Assistant: {answer}\n")
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            logger.error("\nAgent run failed", exc_info=e)
            print("Assistant: Something went wrong while calling the AI. Check the logs.\n")
