import { useState } from "react";
import "./App.css";


const INITIAL_AGENTS = [
  {
    id: "search",
    icon: "🔎",
    name: "Search Agent",
    description: "Waiting",
    status: "idle",
  },
  {
    id: "reader",
    icon: "📖",
    name: "Reader Agent",
    description: "Waiting",
    status: "idle",
  },
  {
    id: "writer",
    icon: "✍️",
    name: "Writer Agent",
    description: "Waiting",
    status: "idle",
  },
  {
    id: "critic",
    icon: "🧠",
    name: "Critic Agent",
    description: "Waiting",
    status: "idle",
  },
];


function App() {

  const [page, setPage] = useState("research");

  const [topic, setTopic] = useState("");

  const [loading, setLoading] = useState(false);

  const [research, setResearch] = useState(null);

  const [error, setError] = useState("");

  const [agents, setAgents] = useState(
    INITIAL_AGENTS
  );


  // =======================================================
  // UPDATE AGENT
  // =======================================================

  const updateAgent = (
    step,
    status,
    description
  ) => {

    setAgents((currentAgents) =>
      currentAgents.map((agent) => {

        if (agent.id !== step) {
          return agent;
        }

        return {
          ...agent,
          status,
          description,
        };

      })
    );
  };


  const renderReport = (report) => {

    const lines = String(report || "").split(/\r?\n/);

    return lines.map((line, index) => {

      const text = line.trim();

      if (!text) {
        return <div className="report-spacer" key={`space-${index}`}></div>;
      }

      const heading = text
        .replace(/^#{1,3}\s+/, "")
        .replace(/:$/, "");

      const isHeading = /^(introduction|key findings|conclusion|sources|overview|summary)$/i.test(heading);

      if (isHeading || /^#{1,3}\s+/.test(text)) {
        return <h3 className="report-heading" key={`heading-${index}`}>{heading}</h3>;
      }

      if (/^[-*•]\s+/.test(text)) {
        return (
          <div className="report-bullet" key={`bullet-${index}`}>
            <span aria-hidden="true">•</span>
            <p>{text.replace(/^[-*•]\s+/, "")}</p>
          </div>
        );
      }

      return <p className="report-paragraph" key={`paragraph-${index}`}>{text}</p>;

    });

  };


  // =======================================================
  // PROCESS SSE EVENT
  // =======================================================

  const processEvent = (eventBlock) => {

    if (!eventBlock.trim()) {
      return;
    }

    const lines = eventBlock.split("\n");

    const dataLine = lines.find(
      (line) => line.startsWith("data:")
    );

    if (!dataLine) {
      return;
    }

    const jsonString = dataLine
      .replace("data:", "")
      .trim();

    if (!jsonString) {
      return;
    }

    const data = JSON.parse(jsonString);


    // =====================================================
    // PROGRESS EVENT
    // =====================================================

    if (data.type === "progress") {

      updateAgent(
        data.step,
        data.status,
        data.message
      );

    }


    // =====================================================
    // COMPLETE EVENT
    // =====================================================

    if (data.type === "complete") {

      setResearch(
        data.result
      );

    }


    // =====================================================
    // ERROR EVENT
    // =====================================================

    if (data.type === "error") {

      setError(
        data.message
      );

    }

  };


  // =======================================================
  // GENERATE RESEARCH
  // =======================================================

  const generateResearch = async () => {

    if (!topic.trim()) {

      setError(
        "Please enter a research topic."
      );

      return;
    }


    setLoading(true);

    setError("");

    setResearch(null);

    setAgents(
      INITIAL_AGENTS.map((agent) => ({
        ...agent,
        status: "idle",
        description: "Waiting",
      }))
    );


    try {

      const response = await fetch(
        "/api/research/stream",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            topic: topic.trim(),
          }),
        }
      );


      if (!response.ok) {

        let message =
          "Unable to start research.";

        try {

          const data =
            await response.json();

          message =
            data.detail || message;

        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(message);
      }


      if (!response.body) {

        throw new Error(
          "Streaming is not supported by this browser."
        );
      }


      // ===================================================
      // READ SSE STREAM
      // ===================================================

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder("utf-8");

      let buffer = "";


      while (true) {

        const {
          value,
          done
        } = await reader.read();


        if (done) {
          break;
        }


        buffer += decoder.decode(
          value,
          {
            stream: true
          }
        );


        const events =
          buffer.split("\n\n");


        // Keep incomplete event
        buffer =
          events.pop();


        for (const eventBlock of events) {

          processEvent(
            eventBlock
          );

        }

      }


      // Process anything left
      if (buffer.trim()) {

        processEvent(
          buffer
        );

      }


    } catch (err) {

      setError(
        err.message ||
        "Something went wrong while generating the report."
      );

    } finally {

      setLoading(false);

    }

  };


  // =======================================================
  // DOWNLOAD REPORT
  // =======================================================

  const downloadReport = () => {

    if (!research?.report) {
      return;
    }


    const blob = new Blob(
      [research.report],
      {
        type: "text/plain;charset=utf-8",
      }
    );


    const url =
      URL.createObjectURL(blob);


    const link =
      document.createElement("a");


    link.href = url;

    link.download =
      "research-report.txt";


    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );


    URL.revokeObjectURL(url);

  };


  // =======================================================
  // AGENT STATUS HELPERS
  // =======================================================

  const getStatusIcon = (status) => {

    if (status === "completed") {
      return "✓";
    }

    if (status === "running") {
      return "⟳";
    }

    return "○";
  };


  // =======================================================
  // RENDER
  // =======================================================

  return (

    <div className="app">


      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <header className="header">

        <div className="brand">

          <div className="brand-icon">
            ✦
          </div>

          <div>

            <h1>
              ResearchAI
            </h1>

            <span>
              Multi-Agent Research System
            </span>

          </div>

        </div>


        <button
          className="page-toggle"
          onClick={() => setPage(page === "research" ? "about" : "research")}
        >
          {page === "research" ? "About the project" : "Back to research"}
          <span aria-hidden="true">{page === "research" ? "→" : "←"}</span>
        </button>

      </header>


      {/* ================================================= */}
      {/* MAIN */}
      {/* ================================================= */}

      {page === "about" ? (
        <main className="container about-page">

          <section className="about-hero">

            <div className="hero-badge">✦ Project story</div>

            <h2>
              From one prompt to a
              <br />
              <span>team of AI agents.</span>
            </h2>

            <p>
              Multi-Agent AI Research System is a practical project built from
              scratch with LangChain and large language models. It orchestrates
              specialized agents that search, read, write, and review together
              to turn a research question into a structured report.
            </p>

          </section>

          <section className="about-section">

            <div className="about-section-heading">
              <span className="eyebrow">THE PIPELINE</span>
              <h3>Four specialists, one research workflow.</h3>
              <p>
                Each agent has a focused responsibility. The output of one
                stage becomes the context that guides the next stage.
              </p>
            </div>

            <div className="workflow-diagram" aria-label="Research workflow from question to final report">
              <div className="workflow-line" aria-hidden="true">
                <span className="workflow-signal"></span>
              </div>
              <div className="workflow-step">
                <span className="workflow-dot input-dot">?</span>
                <strong>Question</strong>
                <small>User topic</small>
              </div>
              <div className="workflow-step">
                <span className="workflow-dot search-dot">01</span>
                <strong>Search</strong>
                <small>Find sources</small>
              </div>
              <div className="workflow-step">
                <span className="workflow-dot reader-dot">02</span>
                <strong>Read</strong>
                <small>Extract context</small>
              </div>
              <div className="workflow-step">
                <span className="workflow-dot writer-dot">03</span>
                <strong>Write</strong>
                <small>Draft report</small>
              </div>
              <div className="workflow-step">
                <span className="workflow-dot critic-dot">04</span>
                <strong>Review</strong>
                <small>Check quality</small>
              </div>
              <div className="workflow-step">
                <span className="workflow-dot output-dot">✓</span>
                <strong>Report</strong>
                <small>Deliver result</small>
              </div>
            </div>

            <div className="workflow-brief">
              <div className="workflow-brief-heading">
                <span className="eyebrow">HOW A REQUEST MOVES</span>
                <h4>From the search bar to a reviewed report.</h4>
              </div>
              <ol className="workflow-steps">
                <li>
                  <strong>Submit a research topic</strong>
                  <span>The user enters a question or subject in the search bar. The React interface sends that topic to the FastAPI backend as a structured request.</span>
                </li>
                <li>
                  <strong>Search for relevant sources</strong>
                  <span>The Search Agent receives the topic and calls the Tavily web-search tool. It identifies relevant links, titles, and supporting snippets from current web results.</span>
                </li>
                <li>
                  <strong>Open and collect source content</strong>
                  <span>The Reader Agent examines the search results, selects a relevant link, opens the source page, and uses the scraping tool to extract readable page content for deeper analysis.</span>
                </li>
                <li>
                  <strong>Write the research report</strong>
                  <span>The Writer Agent receives both the search findings and extracted page content. It synthesizes the information into a structured report with an introduction, key findings, conclusion, and sources.</span>
                </li>
                <li>
                  <strong>Review and deliver the result</strong>
                  <span>The Critic Agent evaluates the completed report, identifies strengths and areas for improvement, and returns its feedback alongside the final report to the user interface.</span>
                </li>
              </ol>
            </div>

            <div className="agent-flow">
              <article className="about-agent search-agent">
                <div className="about-agent-number">01</div>
                <div className="about-agent-icon">🔎</div>
                <h4>Search Agent</h4>
                <p>Uses Tavily to find recent, relevant sources and return useful titles, URLs, and summaries.</p>
              </article>

              <article className="about-agent reader-agent">
                <div className="about-agent-number">02</div>
                <div className="about-agent-icon">📖</div>
                <h4>Reader Agent</h4>
                <p>Selects a promising source and uses a scraping tool to bring deeper page content into the workflow.</p>
              </article>

              <article className="about-agent writer-agent">
                <div className="about-agent-number">03</div>
                <div className="about-agent-icon">✍️</div>
                <h4>Writer Agent</h4>
                <p>Combines search results and source content into a clear report with findings, conclusions, and sources.</p>
              </article>

              <article className="about-agent critic-agent">
                <div className="about-agent-number">04</div>
                <div className="about-agent-icon">🧠</div>
                <h4>Critic Agent</h4>
                <p>Reviews the report for quality, strengths, gaps, and improvements before the research is complete.</p>
              </article>
            </div>

          </section>

          <section className="about-grid">

            <article className="about-copy-block">
              <span className="eyebrow">WHY IT MATTERS</span>
              <h3>More than a chatbot response.</h3>
              <p>
                A single prompt can produce an answer, but a coordinated
                pipeline can divide the work, preserve intermediate context,
                and make each stage easier to inspect. This project demonstrates
                how tool-using agents can cooperate instead of acting as one
                undifferentiated model.
              </p>
            </article>

            <article className="about-copy-block accent-block">
              <span className="eyebrow">WHAT I LEARNED</span>
              <h3>Building the system taught me to think in workflows.</h3>
              <p>
                I learned how to connect LangChain agents to tools, pass state
                between stages, design prompts for different responsibilities,
                handle failures, stream progress with Server-Sent Events, and
                connect a React interface to a FastAPI backend. Most importantly,
                I learned that reliable AI applications need structure,
                validation, and clear boundaries around every model call.
              </p>
            </article>

          </section>

          <section className="about-section use-cases-section">
            <div className="about-section-heading">
              <span className="eyebrow">USE CASES</span>
              <h3>Where this pattern can be useful.</h3>
            </div>

            <div className="use-case-list">
              <div><strong>Academic research</strong><span>Explore a topic, compare sources, and create a first structured draft.</span></div>
              <div><strong>Market intelligence</strong><span>Monitor competitors, industries, and emerging trends from current web sources.</span></div>
              <div><strong>Content preparation</strong><span>Turn scattered research into briefs, outlines, and source-backed reports.</span></div>
              <div><strong>Internal knowledge work</strong><span>Give teams a repeatable way to investigate questions and review results.</span></div>
            </div>
          </section>

          <section className="future-section">
            <div>
              <span className="eyebrow">FUTURE SCOPE</span>
              <h3>The next version can go deeper.</h3>
            </div>
            <p>
              Future improvements could include parallel search agents, source
              credibility scoring, citations linked to exact passages, document
              uploads, persistent research history, human approval checkpoints,
              and a richer evaluation layer for measuring report accuracy.
            </p>
          </section>

          <button className="about-cta" onClick={() => setPage("research")}>
            Start a research workflow <span aria-hidden="true">→</span>
          </button>

        </main>
      ) : (
      <main className="container">


        {/* ================================================= */}
        {/* HERO */}
        {/* ================================================= */}

        <section className="hero">

          <div className="hero-badge">
            ✦ Intelligent Research Assistant
          </div>


          <h2>

            Research anything.

            <br />

            <span>
              Get a structured report.
            </span>

          </h2>


          <p>

            Search the web, analyze relevant sources,
            synthesize information and generate a
            professional research report using multiple
            AI agents.

          </p>

        </section>


        {/* ================================================= */}
        {/* SEARCH */}
        {/* ================================================= */}

        <section className="search-card">

          <label>
            Research Topic
          </label>


          <div className="search-box">

            <span className="search-icon">
              ⌕
            </span>


            <input

              type="text"

              value={topic}

              onChange={(e) =>
                setTopic(e.target.value)
              }

              onKeyDown={(e) => {

                if (
                  e.key === "Enter" &&
                  !loading
                ) {

                  generateResearch();

                }

              }}

              placeholder="Example: Indian cricket team 2026 performance"

              disabled={loading}

            />


            <button

              onClick={
                generateResearch
              }

              disabled={loading}

            >

              {loading
                ? "Researching..."
                : "Generate Report"}

            </button>

          </div>


          {error && (

            <div className="error">
              ⚠ {error}
            </div>

          )}

        </section>


        {/* ================================================= */}
        {/* LIVE PIPELINE */}
        {/* ================================================= */}

        {(loading || research) && (

          <section className="pipeline-card">

            <div className="section-heading">

              <div>

                <span className="eyebrow">
                  {loading
                    ? "LIVE PIPELINE"
                    : "PIPELINE COMPLETE"}
                </span>


                <h3>

                  {loading
                    ? "Agents are working"
                    : "Research pipeline completed"}

                </h3>

              </div>


              {loading && (
                <div className="loader"></div>
              )}

            </div>


            <div className="agents">

              {agents.map((agent) => (

                <div
                  key={agent.id}
                  className={`agent ${agent.status}`}
                >

                  <div className="agent-icon">
                    {agent.icon}
                  </div>


                  <div className="agent-info">

                    <strong>
                      {agent.name}
                    </strong>

                    <span>
                      {agent.description}
                    </span>

                  </div>


                  <div
                    className={`agent-status-icon ${agent.status}`}
                  >
                    {getStatusIcon(
                      agent.status
                    )}
                  </div>

                </div>

              ))}

            </div>

          </section>

        )}


        {/* ================================================= */}
        {/* REPORT */}
        {/* ================================================= */}

        {research && (

          <section className="result-section">


            <div className="result-header">

              <div>

                <span className="eyebrow">
                  RESEARCH COMPLETE
                </span>


                <h2>
                  Research Report
                </h2>


                <p>
                  {research.topic}
                </p>

              </div>


              <button
                className="download-btn"
                onClick={downloadReport}
              >
                ↓ Download Report
              </button>

            </div>


            {/* ============================================= */}
            {/* REPORT */}
            {/* ============================================= */}

            <article className="report">

              <div className="report-label">
                <span className="report-label-mark">✦</span>
                <span>AI-generated research brief</span>
              </div>

              <div className="report-content">
                {renderReport(research.report)}
              </div>

            </article>


            {/* ============================================= */}
            {/* DETAILS */}
            {/* ============================================= */}

            <div className="details">


              <div className="detail-card">

                <h3>
                  🔎 Search Results
                </h3>

                <pre>
                  {research.search_results}
                </pre>

              </div>


              <div className="detail-card">

                <h3>
                  📖 Scraped Content
                </h3>

                <pre>
                  {research.scraped_content}
                </pre>

              </div>


              <div className="detail-card">

                <h3>
                  🧠 Critic Feedback
                </h3>

                <pre>
                  {research.feedback}
                </pre>

              </div>


            </div>

          </section>

        )}

      </main>
      )}


      {/* ================================================= */}
      {/* FOOTER */}
      {/* ================================================= */}

      <footer>

        Built with React • FastAPI • LangChain • Groq • Tavily

      </footer>


    </div>

  );

}


export default App;