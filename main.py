import json
import queue
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pipeline import run_research_pipeline


def user_facing_error(error: Exception) -> str:
    """Convert transient upstream failures into actionable UI messages."""
    message = str(error)

    if any(
        phrase in message.lower()
        for phrase in (
            "remote end closed connection",
            "connection aborted",
            "connection reset",
            "timed out",
        )
    ):
        return (
            "An external research service closed the connection. "
            "Please wait a moment and try again."
        )

    return message or "The research pipeline could not be completed."


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="Multi-Agent Research System",
    description="AI-powered multi-agent research backend",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST MODEL
# =========================================================

class ResearchRequest(BaseModel):
    topic: str


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "message": "Multi-Agent Research System API is running",
    }


# =========================================================
# NORMAL RESEARCH ENDPOINT
# =========================================================

@app.post("/api/research")
def research(request: ResearchRequest):

    topic = request.topic.strip()

    if not topic:
        raise HTTPException(
            status_code=400,
            detail="Research topic cannot be empty.",
        )

    try:

        result = run_research_pipeline(topic)

        return {
            "success": True,
            "topic": topic,
            "report": result["report"],
            "search_results": result["search_results"],
            "scraped_content": result["scraped_content"],
            "feedback": result["feedback"],
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# =========================================================
# SSE RESEARCH ENDPOINT
# =========================================================

@app.post("/api/research/stream")
def research_stream(request: ResearchRequest):

    topic = request.topic.strip()

    if not topic:

        raise HTTPException(
            status_code=400,
            detail="Research topic cannot be empty.",
        )

    # Queue used for communication between
    # the research thread and the SSE stream.
    event_queue = queue.Queue()

    # =====================================================
    # RESEARCH WORKER
    # =====================================================

    def research_worker():

        try:

            # ---------------------------------------------
            # CALLBACK
            # ---------------------------------------------

            def progress_callback(
                step,
                message,
                status
            ):

                event_queue.put({
                    "type": "progress",
                    "step": step,
                    "message": message,
                    "status": status,
                })

            # ---------------------------------------------
            # RUN PIPELINE
            # ---------------------------------------------

            result = run_research_pipeline(
                topic,
                progress_callback
            )

            # ---------------------------------------------
            # FINAL RESULT
            # ---------------------------------------------

            event_queue.put({
                "type": "complete",
                "result": {
                    "success": True,
                    "topic": topic,
                    "report": result["report"],
                    "search_results": result["search_results"],
                    "scraped_content": result["scraped_content"],
                    "feedback": result["feedback"],
                }
            })

        except Exception as e:

            event_queue.put({
                "type": "error",
                "message": user_facing_error(e),
            })

        finally:

            event_queue.put({
                "type": "done"
            })

    # =====================================================
    # START BACKGROUND THREAD
    # =====================================================

    thread = threading.Thread(
        target=research_worker,
        daemon=True
    )

    thread.start()

    # =====================================================
    # SSE GENERATOR
    # =====================================================

    def event_generator():

        while True:

            event = event_queue.get()

            event_type = event.get(
                "type",
                "message"
            )

            # Convert Python dictionary
            # into JSON for React.
            data = json.dumps(
                event,
                ensure_ascii=False
            )

            yield (
                f"event: {event_type}\n"
                f"data: {data}\n\n"
            )

            if event_type == "done":
                break

    # =====================================================
    # STREAM RESPONSE
    # =====================================================

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/")
def root():
    return {"message": "API is running"}