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
        "http://127.0.0.1:8000/api/research/stream",
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


        <div className="header-badge">
          AI Powered
        </div>

      </header>


      {/* ================================================= */}
      {/* MAIN */}
      {/* ================================================= */}

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

              {research.report}

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