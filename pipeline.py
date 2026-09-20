from agents import (
    build_reader_agent,
    build_search_agent,
    writer_chain,
    critic_chain,
)


def run_research_pipeline(
    topic: str,
    progress_callback=None
) -> dict:

    state = {}

    # =========================================================
    # PROGRESS HELPER
    # =========================================================

    def update_progress(
        step: str,
        message: str,
        status: str
    ):
        if progress_callback:
            progress_callback(
                step,
                message,
                status
            )

    # =========================================================
    # STEP 1 — SEARCH AGENT
    # =========================================================

    update_progress(
        "search",
        "Search Agent is searching the web...",
        "running"
    )

    search_agent = build_search_agent()

    search_result = search_agent.invoke({
        "messages": [
            (
                "user",
                f"Find recent, reliable and detailed information about: {topic}"
            )
        ]
    })

    state["search_results"] = (
        search_result["messages"][-1].content
    )

    update_progress(
        "search",
        "Search Agent completed successfully.",
        "completed"
    )

    # =========================================================
    # STEP 2 — READER AGENT
    # =========================================================

    update_progress(
        "reader",
        "Reader Agent is analyzing relevant sources...",
        "running"
    )

    reader_agent = build_reader_agent()

    reader_result = reader_agent.invoke({
        "messages": [
            (
                "user",
                f"""
Based on the following search results about '{topic}',
pick the most relevant URL and scrape it for deeper content.

Search Results:

{state['search_results'][:800]}
"""
            )
        ]
    })

    state["scraped_content"] = (
        reader_result["messages"][-1].content
    )

    update_progress(
        "reader",
        "Reader Agent completed successfully.",
        "completed"
    )

    # =========================================================
    # STEP 3 — WRITER
    # =========================================================

    update_progress(
        "writer",
        "Writer Agent is generating the research report...",
        "running"
    )

    research_combined = (
        f"SEARCH RESULTS:\n"
        f"{state['search_results']}\n\n"
        f"DETAILED SCRAPED CONTENT:\n"
        f"{state['scraped_content']}"
    )

    state["report"] = writer_chain.invoke({
        "topic": topic,
        "research": research_combined
    })

    update_progress(
        "writer",
        "Writer Agent completed the report.",
        "completed"
    )

    # =========================================================
    # STEP 4 — CRITIC
    # =========================================================

    update_progress(
        "critic",
        "Critic Agent is reviewing the research report...",
        "running"
    )

    state["feedback"] = critic_chain.invoke({
        "report": state["report"]
    })

    update_progress(
        "critic",
        "Critic Agent completed the review.",
        "completed"
    )

    return state


# =============================================================
# TERMINAL TEST
# =============================================================

if __name__ == "__main__":

    topic = input(
        "\nEnter a Research Topic: "
    )

    def terminal_progress(step, message, status):
        print(
            f"[{status.upper()}] "
            f"{step.upper()} → {message}"
        )

    result = run_research_pipeline(
        topic,
        terminal_progress
    )

    print("\n")
    print("=" * 60)
    print("FINAL REPORT")
    print("=" * 60)

    print(result["report"])

    print("\n")
    print("=" * 60)
    print("CRITIC FEEDBACK")
    print("=" * 60)

    print(result["feedback"])







































# from agents import build_reader_agent , build_search_agent , writer_chain , critic_chain


# def run_research_pipeline(topic : str) -> dict:
#     state = {}

#     # Search Agent Working 
#     print("\n"+" ="*50)
#     print("Step 1 -- Search Agent is working")
#     print("\n"+" ="*50)

#     search_agent = build_search_agent()
#     search_result = search_agent.invoke({
#         "messages" : [("user", f"Find recent, reliable and detailed information about: {topic}")]
#     })

#     state["search_results"] = search_result['messages'][-1].content
#     print("\n Search Result ", state['search_results'])



#     # Reader Agent Scraping
#     print("\n"+" ="*50)
#     print("Step 2  -- Reader Agent scraping resources..")
#     print("\n"+" ="*50)


#     reader_agent = build_reader_agent()
#     reader_result = reader_agent.invoke({
#         "messages": [(
#             "user",
#             f"Based on the following search results about '{topic}', "
#             f"pick the most relevant URL and scrape it for deeper content.\n\n"
#             f"Search Results:\n{state['search_results'][:800]}"
#         )]
#     })

#     state['scraped_content'] = reader_result['messages'][-1].content
#     print("\n Scraped Content  \n", state['scraped_content'])




#     #  Writer Chain
#     print("\n"+" ="*50)
#     print("Step 3  -- Writer is drafting the report.")
#     print("\n"+" ="*50)

#     research_combined = (
#     f"SEARCH RESULTS:\n{state['search_results']}\n\n"
#     f"DETAILED SCRAPED CONTENT:\n{state['scraped_content']}"
#     )  

#     state["report"] = writer_chain.invoke({
#         "topic" : topic,
#         "research" : research_combined
#     })


#     print("\n Final Report \n", state['report'])



#     # Critic Report 
#     print("\n"+" ="*50)
#     print("Step 4  -- Critic is reviewing the report.")
#     print("\n"+" ="*50)

#     state["feedback"] = critic_chain.invoke({
#         "report" : state['report']
#     })

#     print("\n Critic Report \n", state['feedback'])

#     return state


# if __name__ == "__main__":
#     topic = input("\n Enter a Research Topic : ")
#     run_research_pipeline(topic)





    

