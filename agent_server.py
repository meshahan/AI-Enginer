import os
import shutil
import logging
from pypdf import PdfReader
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Your specific OpenAI Agent SDK
from agents import (
    Agent, 
    Runner, 
    AsyncOpenAI, 
    set_default_openai_client, 
    set_tracing_disabled, 
    set_default_openai_api
)

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("agent_server")

os.makedirs('temp', exist_ok=True)

# ==========================================
# GEMINI API / OPENAI SDK OVERRIDE CONFIG
# ==========================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY is missing. Please set it in your .env file.")

set_tracing_disabled(True)
set_default_openai_api("chat_completions")

external_client = AsyncOpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
set_default_openai_client(external_client)

# ==========================================
# OPENAI AGENT SDK RAG SETUP
# ==========================================
# Global memory block to store uploaded PDF text manually.
document_memory = ""

assistant = Agent(
    name="FastAPIGuide",
    instructions=(
        "You answer questions strictly using the uploaded study notes provided dynamically in user messages. "
        "Explain answers in short friendly sentences. If the notes do not contain the info, say that."
    ),
    model="gemini-2.5-flash",
    tools=[], # Removed incompatible FileSearchTool
)

# ==========================================
# FASTAPI BACKEND SETUP
# ==========================================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global document_memory
    try:
        temp_file_path = f"temp/{file.filename}"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        reader = PdfReader(temp_file_path)
        extracted_text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                extracted_text += extracted + "\n"
                
        document_memory += f"\n--- DOCUMENT SOURCE: {file.filename} ---\n{extracted_text}\n"
        logger.info(f"Ingested {len(extracted_text)} chars from {file.filename}.")
        
        return {
            "status": "success", 
            "message": f"Successfully ingested '{file.filename}' into active agent memory natively via pypdf."
        }
    except Exception as e:
        logger.error(f"Error handling file upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(req: ChatRequest):
    global document_memory
    if not document_memory.strip():
        # Optional safeguard if you'd prefer to return early when no document is ingested:
        # raise HTTPException(status_code=400, detail="No documents ingested yet.")
        pass

    try:
        logger.info(f"User query triggered: {req.message}")
        
        # Manually stuff the document context so we bypass LangChain & FileSearchTool completely
        enriched_prompt = (
            f"Please answer the user's question explicitly relying on the CONTEXT NOTES below.\n\n"
            f"[CONTEXT NOTES]\n{document_memory}\n\n"
            f"[USER QUESTION]\n{req.message}"
        )
        
        result = await Runner.run(assistant, enriched_prompt)
        answer = (result.final_output or "I did not find anything useful in the notes.").strip()
        logger.info(f"Agent generated response.")
        
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Agent error context: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
