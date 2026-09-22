from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.tools import tool
from tavily import TavilyClient
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage
from rich import print
from bs4 import BeautifulSoup

import os
import requests
import time

load_dotenv()



#  TOOL - 1
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

@tool
def web_search(query : str) ->str:
    #doc string 
    """Search the web for recent and reliable information on a topic. Return Titles, URLs and snippets """
    last_error = None

    for attempt in range(3):
        try:
            results = tavily.search(query=query, max_results=5)
            break
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as error:
            last_error = error

            if attempt == 2:
                raise RuntimeError(
                    "The web search service closed the connection after several attempts. "
                    "Please wait a moment and try again."
                ) from error

            time.sleep(1.5 * (attempt + 1))
    else:
        raise RuntimeError("Unable to complete the web search.") from last_error


    out = []

    for r in results['results']:
       out.append(
        f"Title: {r['title']}\nURL: {r['url']}\nSnippet: {r['content'] [:300]}\n"
    )

    return "\n-----\n".join(out)




#  TOOL - 2
@tool
def scrape_url(url: str) -> str:
    # DOC STRING 
    """Scrape and return clean text content from a given URL for deeper reading."""
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()

        return soup.get_text(separator=" ", strip=True)[:3000]

    except Exception as e:
        return f"Could not scrape URL: {str(e)}"

# print(scrape_url.invoke("https://www.cricbuzz.com/cricket-news/140231/athapaththu-fires-sri-lanka-into-asian-games-final"))


print(web_search.args_schema.model_json_schema())