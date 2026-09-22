import { useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const INITIAL_AGENTS = [
  { id: "search", icon: "🔎", name: "Search Agent", description: "Waiting", status: "idle" },
  { id: "reader", icon: "📖", name: "Reader Agent", description: "Waiting", status: "idle" },
  { id: "writer", icon: "✍️", name: "Writer Agent", description: "Waiting", status: "idle" },
  { id: "critic", icon: "🧠", name: "Critic Agent", description: "Waiting", status: "idle" },
];

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function App() {
  const [page, setPage] = useState("research");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [research, setResearch] = useState(null);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState(INITIAL_AGENTS);

  // =======================================================
  // UPDATE AGENT
  // =======================================================
  const updateAgent = (step, status, description) => {
    setAgents((currentAgents) =>
      currentAgents.map((agent) => {
        if (agent.id !== step) return agent;
        return { ...agent, status, description };
      })
    );
  };

  const cleanMarkdown = (value) =>
    value
      .replace(/!?\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      .replace(/[`*_~]/g, "")
      .replace(/^\s*>\s?/, "")
      .trim();

  const formatReportText = (report) =>
    String(report || "")
      .split(/\r?\n/)
      .map((line) => {
        const text = line.trim();
        if (!text) return "";
        const heading = cleanMarkdown(text.replace(/^#{1,3}\s+/, "").replace(/:$/, ""));
        if (/^(introduction|key findings|conclusion|sources|overview|summary)$/i.test(heading) || /^#{1,3}\s+/.test(text)) {
          return heading;
        }
        if (/^[-*•]\s+/.test(text)) {
          return `- ${cleanMarkdown(text.replace(/^[-*•]\s+/, ""))}`;
        }
        return cleanMarkdown(text);
      });

  const renderReport = (report) => {
    const lines = String(report || "").split(/\r?\n/);
    return lines.map((line, index) => {
      const text = line.trim();
      if (!text) return <div className="report-spacer" key={`space-${index}`}></div>;
      const heading = cleanMarkdown(text.replace(/^#{1,3}\s+/, "").replace(/:$/, ""));
      const isHeading = /^(introduction|key findings|conclusion|sources|overview|summary)$/i.test(heading);
      if (isHeading || /^#{1,3}\s+/.test(text)) {
        return (
          <h3 className="report-heading" key={`heading-${index}`} style={{ animationDelay: `${index * 0.04}s` }}>
            <span className="heading-mark" aria-hidden="true"></span>
            {heading}
          </h3>
        );
      }
      if (/^[-*•]\s+/.test(text)) {
        return (
          <div className="report-bullet" key={`bullet-${index}`} style={{ animationDelay: `${index * 0.04}s` }}>
            <span className="bullet-dot" aria-hidden="true"></span>
            <p>{cleanMarkdown(text.replace(/^[-*•]\s+/, ""))}</p>
          </div>
        );
      }
      return (
        <p className="report-paragraph" key={`paragraph-${index}`} style={{ animationDelay: `${index * 0.03}s` }}>
          {cleanMarkdown(text)}
        </p>
      );
    });
  };

  // =======================================================
  // PROCESS SSE EVENT
  // =======================================================
  const processEvent = (eventBlock) => {
    if (!eventBlock.trim()) return;
    const lines = eventBlock.split("\n");
    const dataLine = lines.find((line) => line.startsWith("data:"));
    if (!dataLine) return;
    const jsonString = dataLine.replace("data:", "").trim();
    if (!jsonString) return;
    const data = JSON.parse(jsonString);

    if (data.type === "progress") {
      updateAgent(data.step, data.status, data.message);
    }
    if (data.type === "complete") {
      setResearch(data.result);
    }
    if (data.type === "error") {
      setError(data.message);
    }
  };

  // =======================================================
  // GENERATE RESEARCH
  // =======================================================
  const generateResearch = async () => {
    if (!topic.trim()) {
      setError("Please enter a research topic.");
      return;
    }
    setLoading(true);
    setError("");
    setResearch(null);
    setAgents(
      INITIAL_AGENTS.map((agent) => ({ ...agent, status: "idle", description: "Waiting" }))
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/research/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });

      if (!response.ok) {
        let message = "Unable to start research.";
        try {
          const data = await response.json();
          message = data.detail || message;
        } catch {
          // Ignore
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("Streaming is not supported by this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();
        for (const eventBlock of events) {
          processEvent(eventBlock);
        }
      }
      if (buffer.trim()) {
        processEvent(buffer);
      }
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Unable to reach the research API. Check the deployed backend URL."
          : err.message || "Something went wrong while generating the report."
      );
    } finally {
      setLoading(false);
    }
  };

  // =======================================================
  // DOWNLOAD REPORT
  // =======================================================
  const downloadReport = () => {
    if (!research?.report) return;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const addText = (text, size, font, spacing) => {
      pdf.setFont("helvetica", font);
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, contentWidth);
      const lineHeight = size * 1.45;
      if (y + lines.length * lineHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(lines, margin, y);
      y += lines.length * lineHeight + spacing;
    };

    pdf.setTextColor(45, 48, 65);
    addText("Research Report", 22, "bold", 8);
    addText(research.topic, 11, "normal", 20);

    formatReportText(research.report).forEach((line) => {
      if (!line) {
        y += 8;
        return;
      }
      const isHeading = /^(introduction|key findings|conclusion|sources|overview|summary)$/i.test(line);
      const isBullet = line.startsWith("- ");
      if (isHeading) {
        addText(line, 15, "bold", 8);
      } else if (isBullet) {
        addText(`• ${line.slice(2)}`, 10.5, "normal", 4);
      } else {
        addText(line, 10.5, "normal", 5);
      }
    });

    pdf.save("research-report.pdf");
  };

  // =======================================================
  // AGENT STATUS HELPERS
  // =======================================================
  const getStatusIcon = (status) => {
    if (status === "completed") return "✓";
    if (status === "running") return "";
    return "○";
  };

  // =======================================================
  // RENDER
  // =======================================================
  return (
    <div className="app">
      {/* Aurora background layers */}
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob aurora-1"></div>
        <div className="aurora-blob aurora-2"></div>
        <div className="aurora-blob aurora-3"></div>
        <div className="aurora-grid"></div>
        <div className="aurora-noise"></div>
      </div>

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}
      <header className="header">
        <div className="brand">
          <div className="brand-mark">
            <div className="brand-mark-core"></div>
            <div className="brand-mark-ring"></div>
          </div>
          <div className="brand-text">
            <h1>ResearchAI</h1>
            <span>Multi-Agent Research System</span>
          </div>
        </div>

        <nav className="nav-pill">
          <button
            className={`nav-link ${page === "research" ? "active" : ""}`}
            onClick={() => setPage("research")}
          >
            <span className="nav-dot"></span>
            Research
          </button>
          <button
            className={`nav-link ${page === "about" ? "active" : ""}`}
            onClick={() => setPage("about")}
          >
            <span className="nav-dot"></span>
            About
          </button>
        </nav>
      </header>

      {/* ================================================= */}
      {/* ABOUT PAGE */}
      {/* ================================================= */}
      {page === "about" ? (
        <main className="about">
          {/* Hero */}
          <section className="about-hero reveal">
            <div className="hero-chip">
              <span className="chip-dot"></span>
              Project story · v1.0
            </div>
            <h1 className="hero-title">
              From one prompt to a
              <br />
              <span className="grad-text">team of AI agents.</span>
            </h1>
            <p className="hero-sub">
              A practical project built from scratch with LangChain and large language
              models. It orchestrates specialized agents that search, read, write, and
              review together to turn a research question into a structured report.
            </p>
            <div className="hero-stats">
              <div className="stat">
                <strong>4</strong>
                <span>Specialized agents</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <strong>1</strong>
                <span>Orchestrated pipeline</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <strong>∞</strong>
                <span>Research questions</span>
              </div>
            </div>
          </section>

          {/* Pipeline diagram */}
          <section className="about-section reveal">
            <div className="section-eyebrow">THE PIPELINE</div>
            <h2 className="section-title">
              Four specialists, <span className="grad-text">one workflow.</span>
            </h2>
            <p className="section-desc">
              Each agent has a focused responsibility. The output of one stage becomes
              the context that guides the next.
            </p>

            <div className="pipeline-flow">
              <div className="pipeline-node node-input">
                <div className="node-orb">?</div>
                <strong>Question</strong>
                <small>User topic</small>
              </div>
              <div className="pipeline-connector"><span></span></div>
              <div className="pipeline-node node-search">
                <div className="node-orb">01</div>
                <strong>Search</strong>
                <small>Find sources</small>
              </div>
              <div className="pipeline-connector"><span></span></div>
              <div className="pipeline-node node-reader">
                <div className="node-orb">02</div>
                <strong>Read</strong>
                <small>Extract context</small>
              </div>
              <div className="pipeline-connector"><span></span></div>
              <div className="pipeline-node node-writer">
                <div className="node-orb">03</div>
                <strong>Write</strong>
                <small>Draft report</small>
              </div>
              <div className="pipeline-connector"><span></span></div>
              <div className="pipeline-node node-critic">
                <div className="node-orb">04</div>
                <strong>Review</strong>
                <small>Check quality</small>
              </div>
              <div className="pipeline-connector"><span></span></div>
              <div className="pipeline-node node-output">
                <div className="node-orb">✓</div>
                <strong>Report</strong>
                <small>Deliver result</small>
              </div>
            </div>
          </section>

          {/* Bento grid */}
          <section className="bento">
            <article className="bento-card bento-wide reveal">
              <div className="bento-label">HOW A REQUEST MOVES</div>
              <h3>From the search bar to a reviewed report.</h3>
              <ol className="bento-steps">
                <li>
                  <span className="step-num">01</span>
                  <div>
                    <strong>Submit a research topic</strong>
                    <p>The user enters a question. The React interface sends it to the FastAPI backend as a structured request.</p>
                  </div>
                </li>
                <li>
                  <span className="step-num">02</span>
                  <div>
                    <strong>Search for relevant sources</strong>
                    <p>The Search Agent calls Tavily to identify relevant links, titles, and supporting snippets.</p>
                  </div>
                </li>
                <li>
                  <span className="step-num">03</span>
                  <div>
                    <strong>Open and collect source content</strong>
                    <p>The Reader Agent selects a relevant link and uses a scraping tool to extract readable page content.</p>
                  </div>
                </li>
                <li>
                  <span className="step-num">04</span>
                  <div>
                    <strong>Write the research report</strong>
                    <p>The Writer Agent synthesizes findings into a structured report with findings, conclusion, and sources.</p>
                  </div>
                </li>
                <li>
                  <span className="step-num">05</span>
                  <div>
                    <strong>Review and deliver the result</strong>
                    <p>The Critic Agent evaluates the report, returns feedback, and the final report is delivered to the UI.</p>
                  </div>
                </li>
              </ol>
            </article>

            <article className="bento-card bento-agent agent-search reveal">
              <div className="agent-glow"></div>
              <div className="agent-num">01</div>
              <div className="agent-emoji">🔎</div>
              <h4>Search Agent</h4>
              <p>Uses Tavily to find recent, relevant sources and returns useful titles, URLs, and summaries.</p>
              <div className="agent-tag">Web search</div>
            </article>

            <article className="bento-card bento-agent agent-reader reveal">
              <div className="agent-glow"></div>
              <div className="agent-num">02</div>
              <div className="agent-emoji">📖</div>
              <h4>Reader Agent</h4>
              <p>Selects a promising source and uses a scraping tool to bring deeper page content into the workflow.</p>
              <div className="agent-tag">Scraping</div>
            </article>

            <article className="bento-card bento-agent agent-writer reveal">
              <div className="agent-glow"></div>
              <div className="agent-num">03</div>
              <div className="agent-emoji">✍️</div>
              <h4>Writer Agent</h4>
              <p>Combines search results and source content into a clear report with findings, conclusions, and sources.</p>
              <div className="agent-tag">Synthesis</div>
            </article>

            <article className="bento-card bento-agent agent-critic reveal">
              <div className="agent-glow"></div>
              <div className="agent-num">04</div>
              <div className="agent-emoji">🧠</div>
              <h4>Critic Agent</h4>
              <p>Reviews the report for quality, strengths, gaps, and improvements before research is complete.</p>
              <div className="agent-tag">Evaluation</div>
            </article>

            <article className="bento-card bento-tall reveal">
              <div className="bento-label">WHY IT MATTERS</div>
              <h3>More than a chatbot response.</h3>
              <p>
                A single prompt can produce an answer, but a coordinated pipeline can
                divide the work, preserve intermediate context, and make each stage
                easier to inspect. This project shows how tool-using agents can
                cooperate instead of acting as one undifferentiated model.
              </p>
              <div className="bento-deco">
                <span></span><span></span><span></span>
              </div>
            </article>

            <article className="bento-card bento-accent reveal">
              <div className="bento-label">WHAT I LEARNED</div>
              <h3>Building the system taught me to think in workflows.</h3>
              <p>
                I learned to connect LangChain agents to tools, pass state between
                stages, design prompts for different responsibilities, handle failures,
                stream progress with Server-Sent Events, and connect a React interface
                to a FastAPI backend. Reliable AI applications need structure,
                validation, and clear boundaries around every model call.
              </p>
            </article>

            <article className="bento-card bento-wide reveal">
              <div className="bento-label">USE CASES</div>
              <h3>Where this pattern can be useful.</h3>
              <div className="use-grid">
                <div className="use-item">
                  <div className="use-icon">🎓</div>
                  <strong>Academic research</strong>
                  <span>Explore a topic, compare sources, and create a first structured draft.</span>
                </div>
                <div className="use-item">
                  <div className="use-icon">📊</div>
                  <strong>Market intelligence</strong>
                  <span>Monitor competitors, industries, and emerging trends from current web sources.</span>
                </div>
                <div className="use-item">
                  <div className="use-icon">📝</div>
                  <strong>Content preparation</strong>
                  <span>Turn scattered research into briefs, outlines, and source-backed reports.</span>
                </div>
                <div className="use-item">
                  <div className="use-icon">🏢</div>
                  <strong>Internal knowledge work</strong>
                  <span>Give teams a repeatable way to investigate questions and review results.</span>
                </div>
              </div>
            </article>

            <article className="bento-card bento-future reveal">
              <div className="bento-label">FUTURE SCOPE</div>
              <h3>The next version can go deeper.</h3>
              <p>
                Parallel search agents, source credibility scoring, citations linked to
                exact passages, document uploads, persistent research history, human
                approval checkpoints, and a richer evaluation layer for measuring
                report accuracy.
              </p>
              <div className="future-tags">
                <span>Parallel agents</span>
                <span>Credibility scoring</span>
                <span>Citations</span>
                <span>Document uploads</span>
                <span>History</span>
                <span>Human checkpoints</span>
              </div>
            </article>
          </section>

          <button className="about-cta reveal" onClick={() => setPage("research")}>
            <span>Start a research workflow</span>
            <span className="cta-arrow">→</span>
          </button>
        </main>
      ) : (
        // ================================================= */}
        // RESEARCH PAGE
        // ================================================= */}
        <main className="container">
          {/* HERO */}
          <section className="hero reveal">
            <div className="hero-chip">
              <span className="chip-dot"></span>
              Intelligent Research Assistant
            </div>
            <h1 className="hero-title">
              Research anything.
              <br />
              <span className="grad-text">Get a structured report.</span>
            </h1>
            <p className="hero-sub">
              Search the web, analyze relevant sources, synthesize information and
              generate a professional research report using multiple AI agents.
            </p>
          </section>

          {/* SEARCH */}
          <section className="search-card reveal">
            <div className="search-label">
              <span className="label-dot"></span>
              Research Topic
            </div>
            <div className="search-box">
              <span className="search-icon">⌕</span>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) generateResearch();
                }}
                placeholder="Example: Indian cricket team 2026 performance"
                disabled={loading}
              />
              <button onClick={generateResearch} disabled={loading} className="search-btn">
                <span className="btn-shine"></span>
                {loading ? (
                  <>
                    <span className="btn-spinner"></span>
                    Researching
                  </>
                ) : (
                  <>
                    Generate Report
                    <span className="btn-arrow">→</span>
                  </>
                )}
              </button>
            </div>
            {error && (
              <div className="error">
                <span className="error-icon">⚠</span>
                {error}
              </div>
            )}
          </section>

          {/* LIVE PIPELINE */}
          {(loading || research) && (
            <section className="pipeline-card reveal">
              <div className="pipeline-header">
                <div>
                  <div className="section-eyebrow">
                    {loading ? "LIVE PIPELINE" : "PIPELINE COMPLETE"}
                  </div>
                  <h3 className="pipeline-title">
                    {loading ? "Agents are working" : "Research pipeline completed"}
                  </h3>
                </div>
                {loading && (
                  <div className="pipeline-loader">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
              </div>

              <div className="agents-track">
                {/* Connection line */}
                <svg className="agents-connectors" aria-hidden="true">
                  <defs>
                    <linearGradient id="conn-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c5cff" />
                      <stop offset="50%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#f472b6" />
                    </linearGradient>
                  </defs>
                </svg>

                {agents.map((agent, idx) => (
                  <div key={agent.id} className="agent-wrap">
                    <div className={`agent ${agent.status}`}>
                      <div className="agent-glow"></div>
                      <div className="agent-icon-wrap">
                        <span className="agent-icon">{agent.icon}</span>
                        <span className="agent-num-tag">{String(idx + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="agent-info">
                        <strong>{agent.name}</strong>
                        <span>{agent.description}</span>
                      </div>
                      <div className={`agent-status ${agent.status}`}>
                        {agent.status === "running" ? (
                          <span className="status-ring"></span>
                        ) : (
                          getStatusIcon(agent.status)
                        )}
                      </div>
                    </div>
                    {idx < agents.length - 1 && (
                      <div className={`agent-link ${agents[idx + 1].status !== "idle" ? "active" : ""} ${agent.status === "completed" ? "filled" : ""}`}>
                        <span></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* REPORT */}
          {research && (
            <section className="result-section reveal">
              <div className="result-header">
                <div>
                  <div className="section-eyebrow">RESEARCH COMPLETE</div>
                  <h2 className="result-title">Research Report</h2>
                  <p className="result-topic">{research.topic}</p>
                </div>
                <button className="download-btn" onClick={downloadReport}>
                  <span className="dl-icon">↓</span>
                  Download Report
                </button>
              </div>

              <article className="report">
                <div className="report-label">
                  <span className="report-label-mark">✦</span>
                  <span>AI-generated research brief</span>
                </div>
                <div className="report-content">{renderReport(research.report)}</div>
              </article>

              <div className="details">
                <div className="detail-card">
                  <div className="detail-head">
                    <span className="detail-emoji">🔎</span>
                    <h3>Search Results</h3>
                  </div>
                  <pre>{research.search_results}</pre>
                </div>
                <div className="detail-card">
                  <div className="detail-head">
                    <span className="detail-emoji">📖</span>
                    <h3>Scraped Content</h3>
                  </div>
                  <pre>{research.scraped_content}</pre>
                </div>
                <div className="detail-card">
                  <div className="detail-head">
                    <span className="detail-emoji">🧠</span>
                    <h3>Critic Feedback</h3>
                  </div>
                  <pre>{research.feedback}</pre>
                </div>
              </div>
            </section>
          )}
        </main>
      )}

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-line"></div>
        <div className="footer-content">
          <span className="footer-brand">ResearchAI</span>
          <span className="footer-stack">
            React · FastAPI · LangChain · Groq · Tavily
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;