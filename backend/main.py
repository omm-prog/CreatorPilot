import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from config import HOST, PORT, ENVIRONMENT, get_allowed_origins, is_gemini_configured, is_parallel_configured
from models import PlanRequest, AgentExecutionResult
from agent import analyze_video_idea

logger = logging.getLogger(__name__)

app = FastAPI(
    title="CreatorPilot API",
    description="Backend service for CreatorPilot — AI Production Agent for YouTube Creators with Parallel Search",
    version="1.0.0"
)

# Configure CORS dynamically
origins = get_allowed_origins()
allow_all = "*" in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
@app.get("/api/health")
def health_check():
    """Health check endpoint for container orchestrators and frontend status."""
    return {
        "status": "ok",
        "service": "CreatorPilot Backend",
        "environment": ENVIRONMENT,
        "gemini_configured": is_gemini_configured(),
        "parallel_configured": is_parallel_configured()
    }


@app.post("/api/plan", response_model=AgentExecutionResult)
async def plan_video(request: PlanRequest):
    """
    Primary endpoint: Invokes the Gemini / Google ADK agent to analyze the video idea,
    conduct Parallel Search research if needed, adapt to creator constraints,
    and produce the complete production blueprint.
    """
    clean_idea = request.idea.strip() if request.idea else ""
    if not clean_idea:
        raise HTTPException(
            status_code=400,
            detail="Video idea cannot be empty. Please enter a video concept or topic."
        )

    if len(clean_idea) > 2500:
        raise HTTPException(
            status_code=400,
            detail="Video idea exceeds maximum length (2,500 characters). Please provide a more concise concept."
        )

    if not is_gemini_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Gemini API key is not configured on the server. "
                "Please configure GEMINI_API_KEY in the backend environment."
            )
        )

    try:
        result = await analyze_video_idea(
            idea=clean_idea,
            target_duration=request.target_duration,
            audience=request.audience,
            constraints=request.constraints
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Agent execution encountered an error: {error_msg}", exc_info=True)

        # Sanitize error message to avoid leaking stack traces or credentials
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            user_facing_error = "The AI model is experiencing high demand. Please wait a moment and try again."
        elif "503" in error_msg or "UNAVAILABLE" in error_msg:
            user_facing_error = "AI service is momentarily unavailable due to high demand. Please try again shortly."
        elif "timeout" in error_msg.lower():
            user_facing_error = "The request timed out while formulating the production plan. Please try again."
        else:
            user_facing_error = "CreatorPilot encountered an unexpected error while generating your production plan. Please try again."

        raise HTTPException(
            status_code=500,
            detail=user_facing_error
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
