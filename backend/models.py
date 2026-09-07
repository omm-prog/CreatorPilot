from typing import List, Optional, Union
from pydantic import BaseModel, Field


class CreatorConstraints(BaseModel):
    budget_inr: Optional[float] = Field(
        None,
        description="Available production budget in Indian Rupees (INR), e.g. 5000"
    )
    available_hours: Optional[float] = Field(
        None,
        description="Available production window in hours, e.g. 4.0"
    )
    crew: Optional[str] = Field(
        "solo",
        description="Crew setup: 'solo', 'small team' (2-3 people), or 'larger team' (4+ people)"
    )
    equipment: Optional[Union[str, List[str]]] = Field(
        "smartphone",
        description="Available gear: 'smartphone', 'camera', 'smartphone + mic', 'camera + mic + lighting', or list of items"
    )
    locations: Optional[Union[str, List[str]]] = Field(
        "one room",
        description="Available filming locations: 'one room', 'home studio', 'multiple locations', or list of locations"
    )
    experience: Optional[str] = Field(
        "beginner",
        description="Creator skill level: 'beginner', 'intermediate', or 'advanced'"
    )
    additional_constraints: Optional[str] = Field(
        None,
        description="Free text constraints, e.g. 'Cannot travel, no actors, recording at night'"
    )


class PlanRequest(BaseModel):
    idea: str = Field(
        ...,
        description="The raw video idea or topic entered by the YouTube creator.",
        example="I want to make a 10-minute YouTube video explaining why AI coding tools are becoming popular."
    )
    target_duration: Optional[int] = Field(
        None,
        description="Optional target video duration in minutes (e.g. 5, 8, 10, 15)."
    )
    audience: Optional[str] = Field(
        None,
        description="Optional intended viewer audience (e.g. beginner developers, general tech fans)."
    )
    constraints: Optional[CreatorConstraints] = Field(
        None,
        description="Real-world production constraints (budget, time, gear, crew, location)."
    )


class SourceItem(BaseModel):
    title: str = Field(..., description="Title of the source webpage or document")
    url: str = Field(..., description="Canonical URL of the source")
    publish_date: Optional[str] = Field(None, description="Publish date if available")
    snippet: Optional[str] = Field(None, description="Short factual excerpt from Parallel Search")


class ProjectOverview(BaseModel):
    topic: str = Field(..., description="Core subject matter of the video")
    working_title: str = Field(..., description="High-performing, non-clickbait YouTube title")
    target_audience: str = Field(..., description="Target viewer demographic and skill level")
    video_goal: str = Field(..., description="What value the video provides to the viewer")
    tone: str = Field(..., description="Video tone, e.g., Informative & energetic, Humorous, Thoughtful")
    estimated_duration_minutes: int = Field(..., description="Approximate runtime in minutes")
    video_format: str = Field(..., description="Format e.g. Video Essay, Sketch Comedy, Hands-on Tutorial")


class FeasibilityAnalysis(BaseModel):
    feasibility_score: int = Field(
        ...,
        description="0-100 score indicating how realistically achievable the plan is given creator constraints"
    )
    estimated_production_hours: float = Field(
        ...,
        description="Estimated total production hours required to execute this plan"
    )
    estimated_budget_level: str = Field(
        ...,
        description="Qualitative budget range e.g. 'Low (under ₹2,000)', 'Moderate (₹2,000–₹10,000)', 'High (₹10,000+)'"
    )
    major_constraints: List[str] = Field(
        default_factory=list,
        description="Top bottlenecks or resource constraints identified by the agent"
    )
    feasibility_summary: str = Field(
        ...,
        description="Executive summary on how the creator can succeed within their constraints"
    )


class PlanAdaptation(BaseModel):
    original_approach: str = Field(..., description="Standard or unconstrained production approach")
    adapted_approach: str = Field(..., description="Modified approach tailored to creator's setup")
    why: str = Field(..., description="The agent's design rationale for this adaptation")


class ScheduleBlock(BaseModel):
    time_range: str = Field(..., description="Time slot, e.g. '00:00–00:30' or 'Hour 1'")
    activity: str = Field(..., description="What the creator should be doing during this slot")
    notes: Optional[str] = Field(None, description="Practical speedrun tip or checklist note")


class TimeCutStrategy(BaseModel):
    cut_first: List[str] = Field(
        default_factory=list,
        description="Production elements that can be eliminated first if the creator is running behind schedule"
    )
    do_not_cut: List[str] = Field(
        default_factory=list,
        description="Core narrative or technical pillars that MUST NOT be cut"
    )


class ResearchOverview(BaseModel):
    research_used: bool = Field(..., description="Whether live web research was performed")
    key_findings: List[str] = Field(default_factory=list, description="Top factual points or data discoveries")
    sources: List[SourceItem] = Field(default_factory=list, description="Citations returned from Parallel Search")


class ContentStrategy(BaseModel):
    core_message: str = Field(..., description="The single main takeaway message")
    hook: str = Field(..., description="First 10-20 seconds hook to retain viewer interest")
    viewer_promise: str = Field(..., description="What viewer will learn or feel by the end")
    key_takeaways: List[str] = Field(default_factory=list, description="Key points creator must emphasize")


class VideoSection(BaseModel):
    section: str = Field(..., description="Name of section, e.g., 'Hook & Premise', 'The Turning Point'")
    estimated_time: str = Field(..., description="Timestamp range, e.g. '0:00–0:45'")
    purpose: str = Field(..., description="Narrative purpose of this section")
    talking_points: List[str] = Field(default_factory=list, description="Specific talking points or dialogue beats")


class ShotItem(BaseModel):
    scene: str = Field(..., description="Scene name or story beat")
    shot_type: str = Field(..., description="Camera angle or visual mode, e.g., Medium Close-Up, Screen Capture, Over-The-Shoulder")
    visual: str = Field(..., description="Exact visual description of what is shown on screen")
    audio_or_dialogue: str = Field(..., description="Accompanying voiceover, dialogue, or sound effect")
    b_roll_needed: bool = Field(..., description="Whether supplemental B-roll or graphics are required")
    priority: str = Field("MUST HAVE", description="'MUST HAVE' for critical shots or 'OPTIONAL' for secondary shots")
    estimated_setup_time: Optional[str] = Field(None, description="e.g. '5-10 mins'")
    difficulty: Optional[str] = Field("Easy", description="'Easy', 'Moderate', or 'Challenging'")
    equipment_required: Optional[str] = Field(None, description="Gear needed, e.g., 'Smartphone on desk tripod'")
    location: Optional[str] = Field(None, description="Where to film, e.g., 'Desk / Home Office'")
    notes: Optional[str] = Field(None, description="Pacing or editing advice, e.g., 'Digital punch-in on key quote'")


class ProductionRequirements(BaseModel):
    equipment: List[str] = Field(default_factory=list, description="Realistic equipment for the creator's setup")
    locations: List[str] = Field(default_factory=list, description="Physical sets or recording spots")
    graphics_needed: List[str] = Field(default_factory=list, description="On-screen graphics, lower thirds, or charts")
    b_roll_needed: List[str] = Field(default_factory=list, description="Specific B-roll footage to capture")
    assets_needed: List[str] = Field(default_factory=list, description="Code repos, props, sound effects, or demo accounts")


class RiskItem(BaseModel):
    type: str = Field(..., description="Risk category: Research, Copyright, Production, Pacing, or Visual")
    severity: str = Field(..., description="Severity level: Low, Medium, or High")
    issue: str = Field(..., description="Specific potential pitfall or bottleneck given constraints")
    recommendation: str = Field(..., description="Actionable step creator can take to avoid the issue")


class ChecklistItem(BaseModel):
    phase: str = Field(..., description="Stage: Pre-Production, Production, or Post-Production")
    task: str = Field(..., description="Specific actionable task")


class ProductionPlan(BaseModel):
    project: ProjectOverview = Field(..., description="Project meta details and overview")
    feasibility: FeasibilityAnalysis = Field(..., description="Feasibility analysis and score based on constraints")
    adaptations: List[PlanAdaptation] = Field(default_factory=list, description="Explanations of adaptations made for creator constraints")
    production_schedule: List[ScheduleBlock] = Field(default_factory=list, description="Timed production day schedule respecting available hours")
    time_cut_strategy: TimeCutStrategy = Field(..., description="Prioritized guide on what to cut if short on time")
    research: ResearchOverview = Field(..., description="Research findings and live web citations")
    content_strategy: ContentStrategy = Field(..., description="Hook, core message, and value promise")
    video_structure: List[VideoSection] = Field(default_factory=list, description="Timed chronological section outline")
    shot_list: List[ShotItem] = Field(default_factory=list, description="Scene-by-scene visual and B-roll plan with priority tags")
    production_requirements: ProductionRequirements = Field(..., description="Realistic gear, props, and asset checklist")
    risks: List[RiskItem] = Field(default_factory=list, description="Production risk analysis and remedies")
    production_checklist: List[ChecklistItem] = Field(default_factory=list, description="Pre, production, and post checklist")


class AgentExecutionResult(BaseModel):
    plan: ProductionPlan = Field(..., description="The complete adaptive YouTube production blueprint")
    research_used: bool = Field(..., description="Whether Parallel Search was executed at runtime")
    sources: List[SourceItem] = Field(default_factory=list, description="Citations returned by Parallel")
    agent_steps: List[str] = Field(default_factory=list, description="Real agentic execution steps performed")
