from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.tools import tool
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from tools import web_search, scrape_url
from tavily import TavilyClient
from rich import print

import os
import requests

load_dotenv()

# 1. Model Setup
model = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0
)

# Agents - 1
def build_search_agent():
    return create_agent(
        model = model,
        tools = [web_search]
    )




# Agent - 2
def build_reader_agent():
    return create_agent(
        model = model,
        tools = [scrape_url]
    )

# Writer Chain
writer_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are an expert research writer. Write clear, structured and insightful reports."""
    ),
    (
        "human",
        """Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report as:
- Introduction
- Key Findings (minimum 3 well-explained points)
- Conclusion
- Sources (list all URLs found in the research)

Be detailed, factual and professional."""
    )
])

parser = StrOutputParser()

writer_chain = writer_prompt | model | parser



# Critic Chain
critic_prompt = ChatPromptTemplate.from_messages([
     ("system", "You are a sharp and constructive research critic. Be honest and specific."),
    ("human", """Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this exact format:

Score: X/10

Strengths:
- ...
- ...

Areas to Improve:
- ...
- ...

One line verdict:
..."""),
])

critic_chain = critic_prompt | model | parser












