import asyncio
import json
import logging
from typing import List, Optional
from google import genai
from google.genai import types
from google.genai.errors import ClientError

from config import GEMINI_API_KEY
from models import (
    ProductionPlan,
    CreatorConstraints,
    SourceItem,
    AgentExecutionResult
)
from parallel_tool import execute_parallel_search

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """
You are CreatorPilot, an elite AI Production Agent and Senior YouTube Production Director.
Your job is to take a creator's raw video concept AND their real-world production constraints, then generate an adaptive, feasible, and actionable YouTube production blueprint.

ROLE & PHILOSOPHY:
- Think like an experienced creator-consultant and director.
- Avoid generic filler (NEVER say "use good lighting", "be engaging", or "create nice visuals").
- Give SPECIFIC, practical, actionable instructions tailored to the creator's resources.

CRITICAL CONSTRAINT ADAPTATION RULES:
1. BUDGET (INR):
   - Low Budget (< ₹5,000): Rely on smartphone cameras, free tools (OBS, DaVinci Resolve, CapCut), natural window lighting, and DIY props.
   - High Budget (₹50,000 - ₹100,000+): Recommend professional mirrorless/cinema bodies (Sony FX3/A7IV), wireless lavaliers/boom mics, 3-point aperture lighting, multi-location sets, and professional editors.
2. AVAILABLE TIME:
   - The generated `production_schedule` MUST STRICTLY fit inside the creator's available hours. Do NOT create an 8-hour schedule if the creator has 4 hours.
   - Mark secondary shots as `OPTIONAL` and core shots as `MUST HAVE`.
3. CREW:
   - Solo: Avoid shots requiring simultaneous camera movement or external operators. Use stationary tripods, digital zoom punch-ins, screen captures, and self-recorded B-roll.
   - Small / Larger Team: Delegate audio monitoring, camera operation, and live lighting tweaks.
4. LOCATIONS:
   - One Room: Prevent visual monotony using focal length changes, digital punch-ins (1.2x on 4K), desk switch-ups, screen recordings, on-screen graphics, and macro prop shots.
   - Multiple Locations: Plan travel time and batch-shooting per location.
5. EXPERIENCE:
   - Beginner: Simplify technical demands; focus on crisp audio and clean framing over complex color grading or gimbal work.
   - Advanced: Leverage multi-track audio, stylized color profiles (Log), and sophisticated motion graphics.

AGENTIC RESEARCH RULES (Parallel Search API):
1. You have access to the `parallel_search` tool powered by Parallel Search API.
2. If the video topic requires current market data, recent software releases, current developer benchmarks, news events, or platform algorithm changes, you MUST call `parallel_search`.
3. If the video idea is fictional, comedic, creative, personal, or timeless educational concepts, you MUST NOT call `parallel_search`. Focus on narrative structure, dialogue beats, or visual diagrams.
4. When research is returned from Parallel, extract verified facts into `key_findings` and ground talking points in real data.

SECTIONS TO PRODUCE:
1. PROJECT: Working title (high CTR, non-clickbait), target audience, video goal, tone, estimated duration, video format.
2. FEASIBILITY: Feasibility score (0-100), estimated production hours, estimated budget level, major constraints, feasibility summary.
3. ADAPTATIONS: 2-4 concrete plan adaptations (original_approach, adapted_approach, why).
4. PRODUCTION SCHEDULE: Time-blocked schedule fitting strictly inside available hours.
5. TIME CUT STRATEGY: Prioritized list of what to cut first if falling behind vs what must never be cut.
6. RESEARCH: Key findings and citations (if research used).
7. CONTENT STRATEGY: Core message, gripping 15-second opening hook, viewer promise, and key takeaways.
8. VIDEO STRUCTURE: Chronological breakdown with realistic timestamp ranges (e.g. '0:00–0:45'), section purpose, and talking points.
9. SHOT LIST: Scene-by-scene visual blueprint with shot type, visual details, audio/dialogue cues, priority ('MUST HAVE' vs 'OPTIONAL'), setup time, difficulty, equipment, and location.
10. PRODUCTION REQUIREMENTS: Proportional equipment, locations, graphic overlays, B-roll clips, and digital assets.
11. RISKS: 3-4 genuine production, research, copyright, pacing, or visual risks with severity and actionable recommendations.
12. PRODUCTION CHECKLIST: Stage-by-stage checklist covering Pre-Production, Production, and Post-Production.
"""

PARALLEL_TOOL_DECLARATION = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="parallel_search",
            description="Searches the live web using Parallel Search API to find current market data, tool releases, benchmarks, news, and real-time facts.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "objective": {
                        "type": "STRING",
                        "description": "The clear natural language research objective for Parallel Search"
                    },
                    "search_queries": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "1 to 3 targeted search query keywords"
                    }
                },
                "required": ["objective"]
            }
        )
    ]
)


async def analyze_video_idea(
    idea: str,
    target_duration: Optional[int] = None,
    audience: Optional[str] = None,
    constraints: Optional[CreatorConstraints] = None
) -> AgentExecutionResult:
    """
    Executes the adaptive YouTube production planning pipeline:
    1. Evaluates creator constraints & feasibility
    2. Decides if external research is required and optionally calls Parallel Search
    3. Adapts the blueprint (format, schedule, gear, shot list, risks) to constraints
    4. Returns AgentExecutionResult with verified agent_steps, sources, and full ProductionPlan
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured.")

    client = genai.Client(api_key=GEMINI_API_KEY)
    sources: List[SourceItem] = []
    research_used = False

    candidate_models = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash"]
    last_error: Optional[Exception] = None

    # Construct prompt with explicit creator constraints
    prompt_lines = [f"Creator Video Concept: \"{idea}\""]
    if target_duration:
        prompt_lines.append(f"Requested Video Runtime: {target_duration} minutes")
    if audience:
        prompt_lines.append(f"Target Audience: {audience}")

    if constraints:
        prompt_lines.append("\nREAL-WORLD CREATOR CONSTRAINTS:")
        if constraints.budget_inr is not None:
            prompt_lines.append(f"- Budget: ₹{constraints.budget_inr:,.0f} INR")
        if constraints.available_hours is not None:
            prompt_lines.append(f"- Available Production Time: {constraints.available_hours} hours total (Schedule MUST fit in this window)")
        equip_str = ", ".join(constraints.equipment) if isinstance(constraints.equipment, list) else str(constraints.equipment or "smartphone")
        loc_str = ", ".join(constraints.locations) if isinstance(constraints.locations, list) else str(constraints.locations or "one room")
        if constraints.crew:
            prompt_lines.append(f"- Crew Setup: {constraints.crew}")
        if constraints.equipment:
            prompt_lines.append(f"- Equipment: {equip_str}")
        if constraints.locations:
            prompt_lines.append(f"- Locations: {loc_str}")
        if constraints.experience:
            prompt_lines.append(f"- Experience Level: {constraints.experience}")
        if constraints.additional_constraints:
            prompt_lines.append(f"- Specific Constraints / Obstacles: {constraints.additional_constraints}")
    else:
        prompt_lines.append("\n(No specific constraints provided: assume standard solo creator setup)")

    prompt_lines.append("\nProduce the complete, adaptive YouTube production blueprint.")
    prompt = "\n".join(prompt_lines)

    for attempt in range(2):
        for model_name in candidate_models:
            agent_steps = [
                "Understanding creator objective & format requirements"
            ]

            if constraints:
                avail_h = f"{constraints.available_hours}h window" if constraints.available_hours else "flexible time"
                budget_str = f"₹{constraints.budget_inr:,.0f}" if constraints.budget_inr is not None else "modest budget"
                agent_steps.append(
                    f"Evaluating constraints: {constraints.crew} crew, {equip_str}, {loc_str}, {budget_str}, {avail_h}"
                )
            else:
                agent_steps.append("Evaluating constraints: baseline solo creator parameters")

            agent_steps.append("Determining research requirements")
            sources = []
            research_used = False

            try:
                logger.info(f"Invoking Gemini model for decision turn: {model_name} (attempt {attempt+1})")

                # Turn 1: Model decides whether to call parallel_search
                turn1_resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        tools=[PARALLEL_TOOL_DECLARATION],
                        temperature=0.7,
                    )
                )

                function_call = None
                if turn1_resp.function_calls:
                    function_call = turn1_resp.function_calls[0]

                if function_call and function_call.name == "parallel_search":
                    research_used = True
                    call_args = function_call.args or {}
                    search_objective = call_args.get("objective") or idea
                    search_queries = call_args.get("search_queries") or [search_objective]

                    agent_steps.append(f"Searching current information via Parallel: '{search_objective[:60]}...'")

                    # Execute real Parallel Search
                    search_data = await execute_parallel_search(
                        objective=search_objective,
                        search_queries=search_queries
                    )

                    sources = search_data.get("sources", [])
                    research_context = search_data.get("content", "")

                    if sources:
                        agent_steps.append(f"Analyzing research ({len(sources)} citations retrieved from Parallel)")
                    else:
                        agent_steps.append("Analyzing research (search completed with baseline knowledge)")

                    agent_steps.append("Analyzing feasibility & adapting plan to constraints")
                    agent_steps.append("Formulating content strategy, hook, and viewer promise")
                    agent_steps.append("Structuring time-blocked production schedule & video pacing")
                    agent_steps.append("Generating priority-tagged shot list & B-roll plan")
                    agent_steps.append("Formulating time-cut triage & equipment requirements")

                    # Turn 2: Feed back research to Gemini and produce adaptive ProductionPlan
                    enriched_prompt = (
                        f"{prompt}\n\n"
                        f"--- PARALLEL RESEARCH FINDINGS ---\n"
                        f"Research Objective: {search_objective}\n"
                        f"Live Findings & Market Citations:\n{research_context}\n"
                        f"----------------------------------\n\n"
                        f"Synthesize these current research findings with the creator's real-world constraints to produce the complete, adaptive YouTube production plan."
                    )

                    turn2_resp = client.models.generate_content(
                        model=model_name,
                        contents=enriched_prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION + "\nFormulate the complete adaptive production plan as structured JSON.",
                            response_mime_type="application/json",
                            response_schema=ProductionPlan,
                            temperature=0.7,
                        )
                    )

                    plan_dict = json.loads(turn2_resp.text)
                    plan = ProductionPlan(**plan_dict)
                    plan.research.research_used = True
                    plan.research.sources = sources

                else:
                    # Fictional / creative / evergreen video (no search needed)
                    research_used = False
                    agent_steps.append("Topic is creative/foundational: external research not required")
                    agent_steps.append("Analyzing feasibility & adapting plan to constraints")
                    agent_steps.append("Formulating narrative premise & content strategy")
                    agent_steps.append("Structuring time-blocked production schedule & video pacing")
                    agent_steps.append("Generating priority-tagged shot list & B-roll plan")
                    agent_steps.append("Formulating time-cut triage & equipment requirements")

                    structured_resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION + "\nFormulate the complete adaptive production plan as structured JSON.",
                            response_mime_type="application/json",
                            response_schema=ProductionPlan,
                            temperature=0.7,
                        )
                    )
                    plan_dict = json.loads(structured_resp.text)
                    plan = ProductionPlan(**plan_dict)
                    plan.research.research_used = False
                    plan.research.sources = []

                # Final step
                agent_steps.append("Compiling production checklist & final adaptive blueprint")

                return AgentExecutionResult(
                    plan=plan,
                    research_used=research_used,
                    sources=sources,
                    agent_steps=agent_steps
                )

            except ClientError as ce:
                if "RESOURCE_EXHAUSTED" in str(ce) or "429" in str(ce) or "503" in str(ce) or "UNAVAILABLE" in str(ce):
                    logger.warning(f"Model {model_name} rate-limited or busy. Trying fallback model...")
                    last_error = ce
                    await asyncio.sleep(2)
                    continue
                logger.error(f"Gemini client error on {model_name}: {ce}")
                last_error = ce
                continue
            except Exception as e:
                logger.warning(f"Error on {model_name}: {e}")
                last_error = e
                await asyncio.sleep(2)
                continue

        # If all candidate models had temporary issues, pause before second attempt pass
        if attempt == 0:
            logger.info("Retrying model candidate list after brief backoff...")
            await asyncio.sleep(5)

    if last_error:
        raise last_error

    raise RuntimeError("Failed to generate adaptive YouTube production plan from Gemini.")
