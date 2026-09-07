import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CONSTRAINT_PRESETS = [
  {
    name: "Test A: Low-Budget Solo Smartphone (4h)",
    idea: "I want to make a 10-minute YouTube video about the current AI coding tools market.",
    duration: 10,
    audience: "Software developers & tech professionals",
    constraints: {
      budget_inr: 5000,
      available_hours: 4,
      crew: "solo",
      equipment: "smartphone",
      locations: "one room",
      experience: "beginner",
      additional_constraints: "Cannot travel, recording alone at desk"
    }
  },
  {
    name: "Test B: Pro Studio Team (3 Days, ₹100k)",
    idea: "I want to make a 10-minute YouTube video about the current AI coding tools market.",
    duration: 10,
    audience: "Enterprise developers & software architects",
    constraints: {
      budget_inr: 100000,
      available_hours: 24,
      crew: "5-person crew",
      equipment: "cinema camera + mic + lighting",
      locations: "multiple locations",
      experience: "advanced",
      additional_constraints: "Includes rented tech office & co-working space"
    }
  },
  {
    name: "Test C: Fast 2-Hour Comedy Skit (₹1,000)",
    idea: "I want to create a 5-minute comedy skit about two roommates fighting over Wi-Fi.",
    duration: 5,
    audience: "General comedy & sketch fans",
    constraints: {
      budget_inr: 1000,
      available_hours: 2,
      crew: "solo",
      equipment: "smartphone",
      locations: "one room",
      experience: "beginner",
      additional_constraints: "Single actor playing both roles using cutaway angles"
    }
  },
  {
    name: "Test D: Platform News Sprint (3h, ₹2k)",
    idea: "I want to explain the latest changes to the YouTube recommendation algorithm.",
    duration: 10,
    audience: "YouTube creators & digital video marketers",
    constraints: {
      budget_inr: 2000,
      available_hours: 3,
      crew: "solo",
      equipment: "smartphone + basic microphone",
      locations: "home studio",
      experience: "intermediate",
      additional_constraints: "Fast turnaround required to capitalize on algorithm news"
    }
  }
];

function App() {
  const [idea, setIdea] = useState(
    "I want to make a 10-minute video explaining why AI coding tools are becoming popular."
  );
  const [targetDuration, setTargetDuration] = useState(10);
  const [audience, setAudience] = useState("");

  // Constraint States
  const [showConstraints, setShowConstraints] = useState(true);
  const [budgetInr, setBudgetInr] = useState("5000");
  const [availableHours, setAvailableHours] = useState("4");
  const [crew, setCrew] = useState("solo");
  const [equipment, setEquipment] = useState("smartphone");
  const [locations, setLocations] = useState("one room");
  const [experience, setExperience] = useState("beginner");
  const [additionalConstraints, setAdditionalConstraints] = useState("Cannot travel, recording alone at desk");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [parallelConfigured, setParallelConfigured] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendStatus('online');
        setGeminiConfigured(Boolean(data.gemini_configured));
        setParallelConfigured(Boolean(data.parallel_configured));
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  const applyPreset = (preset) => {
    setIdea(preset.idea);
    setTargetDuration(preset.duration);
    setAudience(preset.audience);
    if (preset.constraints) {
      setBudgetInr(preset.constraints.budget_inr ? String(preset.constraints.budget_inr) : "");
      setAvailableHours(preset.constraints.available_hours ? String(preset.constraints.available_hours) : "");
      setCrew(preset.constraints.crew || "solo");
      setEquipment(preset.constraints.equipment || "smartphone");
      setLocations(preset.constraints.locations || "one room");
      setExperience(preset.constraints.experience || "beginner");
      setAdditionalConstraints(preset.constraints.additional_constraints || "");
      setShowConstraints(true);
    }
  };

  const handlePlanVideo = async () => {
    if (!idea.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCheckedItems({});

    try {
      const constraintsPayload = {
        budget_inr: budgetInr ? parseFloat(budgetInr) : undefined,
        available_hours: availableHours ? parseFloat(availableHours) : undefined,
        crew: crew || undefined,
        equipment: equipment || undefined,
        locations: locations || undefined,
        experience: experience || undefined,
        additional_constraints: additionalConstraints.trim() || undefined
      };

      const payload = {
        idea: idea.trim(),
        target_duration: targetDuration ? parseInt(targetDuration, 10) : undefined,
        audience: audience.trim() || undefined,
        constraints: constraintsPayload
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      let res;
      try {
        res = await fetch(`${API_BASE}/api/plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error("Request timed out after 90 seconds while formulating the plan. Please try again.");
        }
        throw new Error("Could not connect to the CreatorPilot backend service. Please check your network connection.");
      }
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || 'CreatorPilot could not complete the plan. Please try again.');
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while communicating with the agent.');
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklist = (index) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getDomain = (url) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'Web Source';
    }
  };

  const plan = result?.plan;

  const groupedChecklist = React.useMemo(() => {
    if (!plan?.production_checklist) return {};
    return plan.production_checklist.reduce((acc, item) => {
      const phase = item.phase || 'General';
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(item);
      return acc;
    }, {});
  }, [plan]);

  const getScoreClass = (score) => {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="brand-badge">
          🎬 Agentic Cinema Hackathon • Adaptive Constraint Engine
        </div>
        <h1 className="brand-title">CreatorPilot</h1>
        <p className="brand-subtitle">
          Autonomous AI Production Agent that adapts video formats, schedules, shot lists, and gear to your exact real-world constraints.
        </p>
        <div className="status-pill">
          <span className={`status-dot ${backendStatus}`} />
          <span>
            {backendStatus === 'online'
              ? geminiConfigured
                ? parallelConfigured
                  ? 'Gemini Agent & Parallel Search Active'
                  : 'Gemini Active (Set PARALLEL_API_KEY for live web search)'
                : 'Backend Online (Gemini Key Needed)'
              : backendStatus === 'checking'
              ? 'Connecting to Backend...'
              : 'Backend Offline (Start FastAPI server)'}
          </span>
        </div>
      </header>

      {/* Input Card */}
      <section className="glass-card">
        <div className="input-header">
          <h2 className="card-title">What Video Are You Producing?</h2>
          <p className="card-desc">
            Enter your concept and production constraints. CreatorPilot will reason about feasibility, adapt the shot list and schedule, and query Parallel Search if current data is required.
          </p>
        </div>

        <textarea
          className="idea-textarea"
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g., I want to make a 10-minute video explaining why AI coding tools are becoming popular..."
        />

        {/* Quick Constraint Preset Chips */}
        <div style={{ marginTop: '14px' }}>
          <span className="control-label">Quick Constraint Presets (Tests A–D):</span>
          <div className="preset-chip-list">
            {CONSTRAINT_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className="preset-chip"
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Duration & Audience Controls */}
        <div className="controls-row" style={{ marginTop: '14px' }}>
          <div className="control-group">
            <label className="control-label">Target Duration (min)</label>
            <input
              type="number"
              className="control-input"
              min={1}
              max={60}
              value={targetDuration}
              onChange={(e) => setTargetDuration(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div className="control-group">
            <label className="control-label">Target Audience (Optional)</label>
            <input
              type="text"
              className="control-input"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Junior developers, tech enthusiasts"
            />
          </div>
        </div>

        {/* Creator Constraints Form */}
        <div className="constraints-card">
          <div
            className="constraints-header"
            onClick={() => setShowConstraints(!showConstraints)}
            style={{ cursor: 'pointer' }}
          >
            <span>⚙️ Creator Constraints & Production Setup</span>
            <span style={{ fontSize: '0.85rem', color: '#c7d2fe' }}>
              {showConstraints ? '▲ Hide Setup' : '▼ Customize Constraints (Budget, Gear, Time)'}
            </span>
          </div>

          {showConstraints && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="constraints-grid">
                <div className="control-group">
                  <label className="control-label">Budget (INR ₹)</label>
                  <input
                    type="number"
                    className="control-input"
                    value={budgetInr}
                    onChange={(e) => setBudgetInr(e.target.value)}
                    placeholder="e.g. 5000"
                  />
                </div>

                <div className="control-group">
                  <label className="control-label">Available Time (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="control-input"
                    value={availableHours}
                    onChange={(e) => setAvailableHours(e.target.value)}
                    placeholder="e.g. 4"
                  />
                </div>

                <div className="control-group">
                  <label className="control-label">Crew Setup</label>
                  <select
                    className="control-input"
                    value={crew}
                    onChange={(e) => setCrew(e.target.value)}
                  >
                    <option value="solo">Solo Creator (1 person)</option>
                    <option value="small team">Small Team (2-3 people)</option>
                    <option value="larger team">Larger Team (4+ people)</option>
                  </select>
                </div>

                <div className="control-group">
                  <label className="control-label">Equipment</label>
                  <select
                    className="control-input"
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                  >
                    <option value="smartphone">Smartphone Only</option>
                    <option value="smartphone + basic microphone">Smartphone + Mic</option>
                    <option value="camera">Dedicated Camera Only</option>
                    <option value="camera + mic + lighting">Camera + Mic + Lighting</option>
                    <option value="cinema camera + mic + lighting">Cinema Rig (High Budget)</option>
                  </select>
                </div>

                <div className="control-group">
                  <label className="control-label">Available Location</label>
                  <select
                    className="control-input"
                    value={locations}
                    onChange={(e) => setLocations(e.target.value)}
                  >
                    <option value="one room">One Room (Desk / Bedroom)</option>
                    <option value="home studio">Home Studio / Living Room</option>
                    <option value="multiple locations">Multiple Locations (Indoor + Outdoor)</option>
                  </select>
                </div>

                <div className="control-group">
                  <label className="control-label">Creator Experience</label>
                  <select
                    className="control-input"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="control-group">
                <label className="control-label">Additional Constraints / Special Obstacles</label>
                <input
                  type="text"
                  className="control-input"
                  value={additionalConstraints}
                  onChange={(e) => setAdditionalConstraints(e.target.value)}
                  placeholder="e.g. Cannot travel, no actors, recording at night"
                />
              </div>
            </div>
          )}
        </div>

        <div className="action-bar">
          <button
            className="btn-primary"
            onClick={handlePlanVideo}
            disabled={loading || !idea.trim()}
          >
            {loading ? (
              <>
                <div className="spinner" />
                <span>Agent Adapting Plan to Constraints...</span>
              </>
            ) : (
              <>
                <span>⚡ Plan Adaptive Production</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Loading Progress State */}
      {loading && (
        <div className="glass-card execution-steps-card">
          <div className="execution-steps-header">
            <span>⚡ Adaptive Constraint Engine at Work</span>
            <div className="spinner" />
          </div>
          <ul className="execution-step-list">
            <li className="execution-step-item">
              <span className="execution-step-icon done">✓</span>
              <span>Evaluating creator constraints (budget, available hours, gear)</span>
            </li>
            <li className="execution-step-item">
              <span className="execution-step-icon active">⏳</span>
              <span>Determining research requirements & querying Parallel Search</span>
            </li>
            <li className="execution-step-item">
              <span className="execution-step-icon active">⏳</span>
              <span>Computing feasibility score & tailored plan adaptations</span>
            </li>
            <li className="execution-step-item">
              <span className="execution-step-icon active">⏳</span>
              <span>Building strict time-blocked schedule & priority-tagged shot list</span>
            </li>
            <li className="execution-step-item">
              <span className="execution-step-icon active">⏳</span>
              <span>Compiling 'If You Run Out Of Time' triage guide & checklist</span>
            </li>
          </ul>
        </div>
      )}

      {/* Error Alert Box */}
      {error && (
        <div className="alert-box alert-error">
          <div className="alert-title">
            <span>⚠️ Production Planning Alert</span>
          </div>
          <div style={{ marginBottom: '12px' }}>{error}</div>
          <button
            type="button"
            className="preset-chip"
            style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fff', padding: '6px 16px', background: 'rgba(239, 68, 68, 0.15)' }}
            onClick={handlePlanVideo}
            disabled={loading}
          >
            ↻ Retry Plan
          </button>
        </div>
      )}

      {/* Adaptive Production Blueprint Results */}
      {result && plan && (
        <section className="glass-card results-card">
          {/* Main Card Header */}
          <div className="results-header">
            <div>
              <h2 className="card-title">Adaptive Production Blueprint</h2>
              <p className="card-desc">Tailored to your budget, time, gear, and crew resources</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                className={`research-status-pill ${
                  result.research_used ? 'yes' : 'no'
                }`}
              >
                RESEARCH: {result.research_used ? 'YES (Parallel Search)' : 'NO (Creative/Evergreen)'}
              </span>
              <span className="results-badge">Custom Adapted</span>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <nav className="section-nav">
            {[
              { id: 'all', label: 'All Sections' },
              { id: 'feasibility', label: '1. Feasibility' },
              { id: 'adaptations', label: '2. Plan Adaptations' },
              { id: 'schedule', label: '3. Shooting Schedule' },
              { id: 'triage', label: '4. If Short on Time' },
              { id: 'overview', label: '5. Overview' },
              { id: 'strategy', label: '6. Strategy & Hook' },
              { id: 'structure', label: '7. Video Structure' },
              { id: 'shots', label: '8. Shot List' },
              { id: 'requirements', label: '9. Gear & Assets' },
              { id: 'risks', label: '10. Risk Analysis' },
              { id: 'checklist', label: '11. Checklist' },
              { id: 'research', label: `12. Research (${plan.research?.sources?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Real Agent Execution Pipeline */}
          {result.agent_steps && result.agent_steps.length > 0 && (
            <div className="execution-steps-card" style={{ background: 'rgba(11, 13, 20, 0.6)' }}>
              <div className="execution-steps-header">
                <span>🤖 Verified Agent Execution Pipeline</span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {result.agent_steps.length} verified steps
                </span>
              </div>
              <ul className="execution-step-list">
                {result.agent_steps.map((step, idx) => (
                  <li key={idx} className="execution-step-item">
                    <span className="execution-step-icon done">✓</span>
                    <span style={{ color: '#e2e8f0' }}>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 1. FEASIBILITY ANALYSIS */}
          {(activeTab === 'all' || activeTab === 'feasibility') && plan.feasibility && (
            <div className="plan-section">
              <h3 className="section-title">📊 1. Production Feasibility Analysis</h3>
              <div className="feasibility-card">
                <div className="feasibility-header">
                  <div>
                    <span className="overview-label">Feasibility Score</span>
                    <div style={{ marginTop: '4px' }}>
                      <span className={`score-badge ${getScoreClass(plan.feasibility.feasibility_score)}`}>
                        {plan.feasibility.feasibility_score} / 100
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="overview-label">Estimated Production Time</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                      ⏱️ {plan.feasibility.estimated_production_hours} Hours
                    </div>
                  </div>
                  <div>
                    <span className="overview-label">Estimated Budget Scale</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a5b4fc', marginTop: '4px' }}>
                      💰 {plan.feasibility.estimated_budget_level}
                    </div>
                  </div>
                </div>

                {plan.feasibility.major_constraints && plan.feasibility.major_constraints.length > 0 && (
                  <div>
                    <span className="control-label">Identified Bottlenecks:</span>
                    <div style={{ marginTop: '4px' }}>
                      {plan.feasibility.major_constraints.map((c, idx) => (
                        <span key={idx} className="constraint-pill">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="strategy-box" style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
                  <span className="strategy-label">Executive Feasibility Verdict</span>
                  <p style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    {plan.feasibility.feasibility_summary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. PLAN ADAPTATIONS */}
          {(activeTab === 'all' || activeTab === 'adaptations') && plan.adaptations && plan.adaptations.length > 0 && (
            <div className="plan-section">
              <h3 className="section-title">🎯 2. Plan Adaptations (Why We Changed the Plan)</h3>
              <div className="adaptations-grid">
                {plan.adaptations.map((adapt, idx) => (
                  <div key={idx} className="adaptation-card">
                    <div className="adapt-comparison">
                      <span className="control-label">Standard Concept:</span>
                      <span className="adapt-from">{adapt.original_approach}</span>
                      <span className="control-label" style={{ marginTop: '4px' }}>Adapted For You:</span>
                      <span className="adapt-to">✓ {adapt.adapted_approach}</span>
                    </div>
                    <div className="adapt-why">
                      <strong>Rationale:</strong> {adapt.why}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. TIME-BLOCKED PRODUCTION SCHEDULE */}
          {(activeTab === 'all' || activeTab === 'schedule') && plan.production_schedule && plan.production_schedule.length > 0 && (
            <div className="plan-section">
              <h3 className="section-title">⏱️ 3. Production Schedule (Fits Within Your Time Limit)</h3>
              <div className="schedule-list">
                {plan.production_schedule.map((block, idx) => (
                  <div key={idx} className="schedule-card">
                    <span className="schedule-time">{block.time_range}</span>
                    <div className="schedule-content">
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{block.activity}</span>
                      {block.notes && (
                        <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>{block.notes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. IF YOU RUN OUT OF TIME (TRIAGE) */}
          {(activeTab === 'all' || activeTab === 'triage') && plan.time_cut_strategy && (
            <div className="plan-section">
              <h3 className="section-title">⏳ 4. If You Run Out Of Time (Triage Guide)</h3>
              <div className="triage-grid">
                <div className="triage-card cut-first">
                  <div className="triage-title">🛑 Cut First (Drop if falling behind schedule)</div>
                  <ul className="talking-points-list">
                    {plan.time_cut_strategy.cut_first?.map((item, idx) => (
                      <li key={idx} className="talking-point-item">
                        <span style={{ color: '#fca5a5' }}>✕</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="triage-card do-not-cut">
                  <div className="triage-title">🛡️ Do Not Cut (Essential video pillars)</div>
                  <ul className="talking-points-list">
                    {plan.time_cut_strategy.do_not_cut?.map((item, idx) => (
                      <li key={idx} className="talking-point-item">
                        <span style={{ color: '#34d399' }}>✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 5. PROJECT OVERVIEW */}
          {(activeTab === 'all' || activeTab === 'overview') && (
            <div className="plan-section">
              <h3 className="section-title">🎬 5. Project Overview</h3>
              <div className="overview-grid">
                <div className="overview-card featured">
                  <span className="overview-label">Working Video Title</span>
                  <span className="overview-value">{plan.project?.working_title}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Format</span>
                  <span className="overview-value">{plan.project?.video_format}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Target Duration</span>
                  <span className="overview-value">{plan.project?.estimated_duration_minutes} minutes</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Tone</span>
                  <span className="overview-value">{plan.project?.tone}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Target Audience</span>
                  <span className="overview-value">{plan.project?.target_audience}</span>
                </div>
                <div className="overview-card" style={{ gridColumn: '1 / -1' }}>
                  <span className="overview-label">Core Video Goal</span>
                  <span className="overview-value" style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {plan.project?.video_goal}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 6. CONTENT STRATEGY */}
          {(activeTab === 'all' || activeTab === 'strategy') && (
            <div className="plan-section">
              <h3 className="section-title">💡 6. Content Strategy & Opening Hook</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="strategy-box hook-box">
                  <span className="strategy-label">⚡ Opening Hook (First 15-20 Seconds)</span>
                  <p className="strategy-text">"{plan.content_strategy?.hook}"</p>
                </div>
                <div className="strategy-box promise-box">
                  <span className="strategy-label">🎯 Viewer Promise</span>
                  <p className="strategy-text">{plan.content_strategy?.viewer_promise}</p>
                </div>
                <div className="strategy-box">
                  <span className="strategy-label">📌 Central Core Message</span>
                  <p className="strategy-text">{plan.content_strategy?.core_message}</p>
                </div>
                {plan.content_strategy?.key_takeaways && plan.content_strategy.key_takeaways.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span className="control-label">Key Value Takeaways:</span>
                    <ul className="talking-points-list" style={{ marginTop: '8px' }}>
                      {plan.content_strategy.key_takeaways.map((point, idx) => (
                        <li key={idx} className="talking-point-item">
                          <span className="talking-point-bullet">✦</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. VIDEO STRUCTURE */}
          {(activeTab === 'all' || activeTab === 'structure') && (
            <div className="plan-section">
              <h3 className="section-title">⏱️ 7. Timed Video Structure</h3>
              <div className="timeline-list">
                {plan.video_structure?.map((sec, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="timestamp-badge">{sec.estimated_time}</span>
                        <span className="section-name">{sec.section}</span>
                      </div>
                      <span className="section-purpose">{sec.purpose}</span>
                    </div>
                    {sec.talking_points && sec.talking_points.length > 0 && (
                      <ul className="talking-points-list">
                        {sec.talking_points.map((pt, pIdx) => (
                          <li key={pIdx} className="talking-point-item">
                            <span className="talking-point-bullet">›</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. SHOT LIST WITH CONSTRAINTS */}
          {(activeTab === 'all' || activeTab === 'shots') && (
            <div className="plan-section">
              <h3 className="section-title">🎥 8. Shot List & Visual B-Roll Plan</h3>
              <div className="shot-grid">
                {plan.shot_list?.map((shot, idx) => (
                  <div key={idx} className="shot-card">
                    <div className="shot-header">
                      <span className="shot-type-badge">{shot.shot_type}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className={`priority-tag ${(shot.priority || 'must-have').toLowerCase().replace(/\s+/g, '-')}`}>
                          {shot.priority || 'MUST HAVE'}
                        </span>
                        {shot.difficulty && (
                          <span className="difficulty-tag">{shot.difficulty}</span>
                        )}
                        {shot.b_roll_needed && (
                          <span className="b-roll-badge">B-Roll</span>
                        )}
                      </div>
                    </div>
                    <div className="shot-scene">{shot.scene}</div>
                    <div className="shot-field">
                      <span className="shot-field-label">Visual Action</span>
                      <span style={{ color: '#e2e8f0' }}>{shot.visual}</span>
                    </div>
                    <div className="shot-field">
                      <span className="shot-field-label">Audio / Dialogue</span>
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                        {shot.audio_or_dialogue}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                      {shot.equipment_required && <span>📷 {shot.equipment_required}</span>}
                      {shot.location && <span>📍 {shot.location}</span>}
                      {shot.estimated_setup_time && <span>⏳ {shot.estimated_setup_time}</span>}
                    </div>
                    {shot.notes && (
                      <div className="shot-notes">
                        <strong>Director's Note:</strong> {shot.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. PRODUCTION REQUIREMENTS */}
          {(activeTab === 'all' || activeTab === 'requirements') && (
            <div className="plan-section">
              <h3 className="section-title">📦 9. Production Requirements (Matched to Setup)</h3>
              <div className="req-grid">
                <div className="req-card">
                  <div className="req-title">🎙️ Equipment</div>
                  <ul className="req-list">
                    {plan.production_requirements?.equipment?.map((item, idx) => (
                      <li key={idx} className="req-item">
                        <span className="req-bullet">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="req-card">
                  <div className="req-title">📍 Locations / Sets</div>
                  <ul className="req-list">
                    {plan.production_requirements?.locations?.map((item, idx) => (
                      <li key={idx} className="req-item">
                        <span className="req-bullet">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="req-card">
                  <div className="req-title">📊 Graphics & Overlays</div>
                  <ul className="req-list">
                    {plan.production_requirements?.graphics_needed?.map((item, idx) => (
                      <li key={idx} className="req-item">
                        <span className="req-bullet">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="req-card">
                  <div className="req-title">🎞️ B-Roll Needed</div>
                  <ul className="req-list">
                    {plan.production_requirements?.b_roll_needed?.map((item, idx) => (
                      <li key={idx} className="req-item">
                        <span className="req-bullet">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="req-card">
                  <div className="req-title">🗂️ Digital Assets / Repos</div>
                  <ul className="req-list">
                    {plan.production_requirements?.assets_needed?.map((item, idx) => (
                      <li key={idx} className="req-item">
                        <span className="req-bullet">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 10. RISK ANALYSIS */}
          {(activeTab === 'all' || activeTab === 'risks') && (
            <div className="plan-section">
              <h3 className="section-title">🛡️ 10. Production Risk Analysis</h3>
              <div className="risks-list">
                {plan.risks?.map((risk, idx) => (
                  <div key={idx} className="risk-card">
                    <div className="risk-header">
                      <span style={{ fontWeight: 700, color: '#a5b4fc' }}>
                        {risk.type} Risk
                      </span>
                      <span className={`risk-severity ${(risk.severity || '').toLowerCase()}`}>
                        {risk.severity} Severity
                      </span>
                    </div>
                    <div className="risk-issue">{risk.issue}</div>
                    <div className="risk-remedy">
                      <span>✓</span>
                      <span><strong>Recommendation:</strong> {risk.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 11. CHECKLIST */}
          {(activeTab === 'all' || activeTab === 'checklist') && (
            <div className="plan-section">
              <h3 className="section-title">✅ 11. Production Checklist</h3>
              <div className="checklist-phases">
                {Object.entries(groupedChecklist).map(([phase, items], pIdx) => (
                  <div key={pIdx} className="checklist-phase-card">
                    <div className="phase-title">{phase}</div>
                    <ul className="checklist-items">
                      {items.map((item, iIdx) => {
                        const globalIndex = `${pIdx}-${iIdx}`;
                        const isDone = Boolean(checkedItems[globalIndex]);
                        return (
                          <li
                            key={iIdx}
                            className={`checklist-item ${isDone ? 'checked' : ''}`}
                            onClick={() => toggleChecklist(globalIndex)}
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => {}}
                            />
                            <span>{item.task}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12. RESEARCH & SOURCES */}
          {(activeTab === 'all' || activeTab === 'research') && (
            <div className="plan-section">
              <h3 className="section-title">🌐 12. Research & Citations (Parallel Search Track)</h3>
              {plan.research?.key_findings && plan.research.key_findings.length > 0 && (
                <div className="strategy-box">
                  <span className="strategy-label">Verified Research Discoveries</span>
                  <ul className="talking-points-list" style={{ marginTop: '8px' }}>
                    {plan.research.key_findings.map((f, idx) => (
                      <li key={idx} className="talking-point-item">
                        <span className="talking-point-bullet">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.research?.sources && plan.research.sources.length > 0 ? (
                <div className="sources-grid" style={{ marginTop: '12px' }}>
                  {plan.research.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-card"
                    >
                      <div className="source-header">
                        <span className="source-domain">{getDomain(source.url)}</span>
                        {source.publish_date && (
                          <span className="source-date">{source.publish_date}</span>
                        )}
                      </div>
                      <div className="source-title">{source.title}</div>
                      {source.snippet && (
                        <div className="source-snippet">{source.snippet}</div>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="strategy-box" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.92rem' }}>
                    {result.research_used
                      ? 'Parallel Search was called, and baseline factual grounding was applied.'
                      : 'This concept was determined to be creative or foundational. No real-time web retrieval was necessary.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="footer">
        CreatorPilot • Built for Agentic Cinema Hackathon (Google ADK & Gemini + Parallel Search Track)
      </footer>
    </div>
  );
}

export default App;
