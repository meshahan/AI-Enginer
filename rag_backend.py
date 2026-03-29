import os
import shutil
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory global FAISS store
vector_store = None
# You must set OPENAI_API_KEY environment variable. 
# Or you can change this to use Anthropic / ChatAnthropic
embeddings = OpenAIEmbeddings()
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

os.makedirs('temp', exist_ok=True)

class ChatRequest(BaseModel):
    message: str

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global vector_store
    try:
        temp_file_path = f"temp/{file.filename}"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 1. Document Loading
        loader = PyPDFLoader(temp_file_path)
        documents = loader.load()
        
        # 2. Text Splitting/Chunking
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = text_splitter.split_documents(documents)
        
        # 3. Vector Imbeddings & In-Memory Store via FAISS
        if vector_store is None:
            vector_store = FAISS.from_documents(docs, embeddings)
        else:
            vector_store.add_documents(docs)
            
        return {"status": "success", "message": f"Ingested {len(docs)} chunks from {file.filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(req: ChatRequest):
    global vector_store
    if vector_store is None:
        raise HTTPException(status_code=400, detail="No documents ingested yet.")
    
    try:
        # 4. RAG Retrieval Step
        retriever = vector_store.as_retriever(search_kwargs={"k": 4})
        system_prompt = (
            "You are a professional, highly intelligent Campaign Knowledge Bot.\n"
            "Use the following pieces of retrieved context to answer the question.\n"
            "If you don't know the answer, say that you don't know.\n"
            "Use Markdown to structure responses beautifully as requested.\n\n"
            "Context: {context}"
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])
        
        question_answer_chain = create_stuff_documents_chain(llm, prompt)
        rag_chain = create_retrieval_chain(retriever, question_answer_chain)
        
        # 5. Generation Step
        response = rag_chain.invoke({"input": req.message})
        return {"answer": response["answer"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
