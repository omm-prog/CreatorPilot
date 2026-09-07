import logging
from typing import List, Optional, Dict, Any
import httpx
from config import PARALLEL_API_KEY, is_parallel_configured
from models import SourceItem

logger = logging.getLogger(__name__)

PARALLEL_SEARCH_URL = "https://api.parallel.ai/v1/search"


class ParallelSearchError(Exception):
    """Custom exception for Parallel Search API errors."""
    pass


async def execute_parallel_search(
    objective: str,
    search_queries: Optional[List[str]] = None,
    mode: str = "fast"
) -> Dict[str, Any]:
    """
    Executes a real query against the official Parallel Search API (v1/search).
    Returns a cleaned, structured dictionary of results suitable for LLM reasoning and frontend citation.
    """
    if not is_parallel_configured():
        logger.warning("Parallel Search called, but PARALLEL_API_KEY is not configured.")
        return {
            "error": "PARALLEL_API_KEY is not configured in backend/.env. Please set it to enable live web research.",
            "sources": [],
            "content": "Web research could not be performed because PARALLEL_API_KEY is missing."
        }

    queries = search_queries if search_queries else [objective]

    payload = {
        "objective": objective,
        "search_queries": queries[:3],  # Best practice: 1-3 targeted queries
        "mode": mode
    }

    headers = {
        "Content-Type": "application/json",
        "x-api-key": PARALLEL_API_KEY
    }

    logger.info(f"Calling Parallel Search API with objective: {objective!r}")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(PARALLEL_SEARCH_URL, json=payload, headers=headers)

            if response.status_code == 401:
                logger.error("Parallel API authentication failed (401 Unauthorized). Check PARALLEL_API_KEY.")
                return {
                    "error": "Parallel API Authentication Failed (Invalid API Key).",
                    "sources": [],
                    "content": "Could not retrieve live information due to an invalid Parallel API Key."
                }

            if response.status_code == 429:
                logger.warning("Parallel API rate limit reached (429).")
                return {
                    "error": "Parallel API rate limit exceeded.",
                    "sources": [],
                    "content": "Rate limit exceeded on Parallel Search. Using core knowledge."
                }

            response.raise_for_status()
            data = response.json()

    except httpx.TimeoutException:
        logger.warning("Parallel Search API request timed out (15s limit).")
        return {
            "error": "Parallel API search request timed out.",
            "sources": [],
            "content": "Search request timed out. Proceeding with baseline planning."
        }
    except Exception as e:
        logger.error(f"Parallel Search API error: {e}")
        return {
            "error": f"Parallel API call failed: {str(e)}",
            "sources": [],
            "content": "Parallel search failed. Proceeding with baseline knowledge."
        }

    raw_results = data.get("results", [])
    logger.info(f"Parallel Search returned {len(raw_results)} results.")

    parsed_sources: List[SourceItem] = []
    formatted_excerpts: List[str] = []

    for item in raw_results:
        title = item.get("title") or "Web Source"
        url = item.get("url") or ""
        publish_date = item.get("publish_date")
        excerpts = item.get("excerpts") or []

        snippet = " ".join(excerpts) if isinstance(excerpts, list) else str(excerpts)
        snippet_clean = snippet[:350].strip() if snippet else None

        if url:
            parsed_sources.append(SourceItem(
                title=title,
                url=url,
                publish_date=publish_date,
                snippet=snippet_clean
            ))

        formatted_excerpts.append(
            f"Source: {title} ({url})\nDate: {publish_date or 'N/A'}\nExcerpt: {snippet_clean or 'No excerpt'}"
        )

    llm_context = "\n\n---\n\n".join(formatted_excerpts) if formatted_excerpts else "No specific web excerpts found."

    return {
        "sources": parsed_sources,
        "content": llm_context
    }
