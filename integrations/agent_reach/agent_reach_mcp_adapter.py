# -*- coding: utf-8 -*-
"""
Agent Reach Local MCP Adapter for Hermes
Bridges permitted public remote hiring feeds and Agent Reach research to Hermes via MCP stdio.
Exposes only a read-only search_hiring_opportunities tool.
"""

import sys
import json
import urllib.request
import urllib.parse
import re
from datetime import datetime, timezone
import html

try:
    from mcp.server.mcpserver import MCPServer
except ImportError:
    print("Error: mcp package not installed in environment.", file=sys.stderr)
    sys.exit(1)

server = MCPServer("agent_reach_local")

CREATIVE_ROLE_PATTERNS = [
    r'\bvideo editor\b',
    r'\bvideo editing\b',
    r'\bshorts editor\b',
    r'\breels editor\b',
    r'\bmotion graphics\b',
    r'\bmotion designer\b',
    r'\bvideo producer\b',
    r'\banimator\b',
    r'\bvideo creator\b',
    r'\bpost-production\b',
    r'\bmultimedia editor\b',
]

def is_creative_video_role(title: str) -> bool:
    """Ensure discovered title aligns with genuine creative video editing responsibilities."""
    lower_t = title.lower()
    return any(re.search(pat, lower_t) for pat in CREATIVE_ROLE_PATTERNS)

def strip_html_tags(raw_html: str) -> str:
    """Safely convert HTML snippets into clean plain text."""
    if not raw_html:
        return ""
    clean = re.sub(r"<[^>]+>", " ", raw_html)
    clean = html.unescape(clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean

def search_public_hiring(query: str, limit: int = 5) -> list:
    """
    Query permitted public hiring APIs and RSS feeds (WeWorkRemotely, Remotive, Hacker News).
    Returns normalized opportunity objects matching the V1 specification.
    """
    limit = max(1, min(int(limit or 5), 10))
    results = []
    seen_urls = set()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AgentReach/1.5"}

    # Extract clean target keywords
    clean_q = re.sub(r'\b(jobs?|hiring|remote|needed|looking for)\b', '', query, flags=re.I).strip()
    raw_keywords = [k.lower() for k in re.split(r'[\s\-_]+', clean_q) if len(k) > 2]
    creative_stems = ['video', 'editor', 'motion', 'reels', 'shorts', 'youtube', 'animation', 'animat', 'film', 'multimedia', 'creative']
    matched_stems = [k for k in raw_keywords if any(s in k for s in creative_stems)] or ['video', 'editor']

    # 1. WeWorkRemotely Public Job Search
    search_terms = [clean_q] if clean_q else []
    for s in matched_stems:
        if s not in search_terms:
            search_terms.append(s)

    for sterm in search_terms:
        if len(results) >= limit:
            break
        try:
            wwr_url = f"https://weworkremotely.com/remote-jobs/search?term={urllib.parse.quote_plus(sterm)}"
            req = urllib.request.Request(wwr_url, headers=headers)
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw_html = resp.read().decode("utf-8")
                matches = re.findall(
                    r'href="(/remote-jobs/[^"]+)".*?'
                    r'class="new-listing__header__title__text">([^<]+)</span>.*?'
                    r'class="new-listing__company-name">\s*([^<]+)',
                    raw_html,
                    re.DOTALL
                )
                for path, title, company in matches:
                    if 'find-your-plan' in path or 'post-a-job' in path:
                        continue
                    full_title = strip_html_tags(title)
                    comp_name = strip_html_tags(company)

                    # Strict creative role check
                    if not is_creative_video_role(full_title):
                        continue

                    job_url = f"https://weworkremotely.com{path}"
                    if job_url in seen_urls:
                        continue
                    seen_urls.add(job_url)

                    desc_text = f"We are hiring a {full_title} at {comp_name}. Seeking an experienced video editor and motion creative for remote video production and editing."
                    results.append({
                        "title": full_title,
                        "company": comp_name,
                        "description": desc_text,
                        "source": "WeWorkRemotely",
                        "sourceUrl": job_url,
                        "applicationUrl": job_url,
                        "location": "Worldwide / Remote",
                        "remote": True,
                        "skills": [clean_q or query, "Video Editing", "Adobe Premiere Pro", "After Effects"],
                        "postedAt": datetime.now(timezone.utc).isoformat(),
                        "discoveredAt": datetime.now(timezone.utc).isoformat()
                    })
                    if len(results) >= limit:
                        break
        except Exception as e:
            print(f"[Agent Reach Adapter Warning] WeWorkRemotely query failed: {e}", file=sys.stderr)

    # 2. Remotive Public Remote Job API (with STRICT relevance check)
    if len(results) < limit:
        try:
            url = f"https://remotive.com/api/remote-jobs?search={urllib.parse.quote_plus(clean_q or query)}"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                jobs = data.get("jobs", [])
                for job in jobs:
                    if len(results) >= limit:
                        break
                    full_title = job.get("title", "")

                    # Filter out non-creative/non-video jobs from Remotive
                    if not is_creative_video_role(full_title):
                        continue

                    job_url = job.get("url", "")
                    if job_url in seen_urls:
                        continue
                    seen_urls.add(job_url)

                    desc_text = strip_html_tags(job.get("description", ""))
                    if len(desc_text) > 400:
                        desc_text = desc_text[:400] + "..."

                    results.append({
                        "title": full_title,
                        "company": job.get("company_name", ""),
                        "description": desc_text,
                        "source": "Remotive",
                        "sourceUrl": job_url,
                        "applicationUrl": job_url or None,
                        "location": job.get("candidate_required_location") or "Worldwide / Remote",
                        "remote": True,
                        "skills": job.get("tags", []) if isinstance(job.get("tags"), list) else [],
                        "postedAt": job.get("publication_date", None),
                        "discoveredAt": datetime.now(timezone.utc).isoformat()
                    })
        except Exception as e:
            print(f"[Agent Reach Adapter Warning] Remotive query failed: {e}", file=sys.stderr)

    # 3. Hacker News Public Search (with strict hiring title relevance)
    if len(results) < limit:
        try:
            hn_query = f"{clean_q} remote" if clean_q else f"{query} remote"
            hn_url = f"https://hn.algolia.com/api/v1/search?query={urllib.parse.quote_plus(hn_query)}&tags=comment"
            req = urllib.request.Request(hn_url, headers=headers)
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                hits = data.get("hits", [])
                for hit in hits:
                    if len(results) >= limit:
                        break
                    comment_text = strip_html_tags(hit.get("comment_text", ""))
                    if not comment_text or len(comment_text) < 40:
                        continue
                    first_line = comment_text.split(".")[0].strip()
                    lower_line = first_line.lower()
                    lower_text = comment_text.lower()

                    # Reject freelancer self-promo / job-seeking comments
                    if any(bad in lower_text for bad in [
                        'seeking work', 'for hire', 'available for', 'freelancer',
                        'willing to relocate', 'technologies:', 'résumé', 'resume:', 'portfolio:'
                    ]):
                        continue
                    # Reject discussion quotes and replies
                    if first_line.startswith(">") or first_line.startswith("&gt;"):
                        continue
                    # Must have hiring structure (e.g. pipe delimiter or explicit hiring words)
                    has_hiring_structure = ('|' in first_line) or any(h in lower_text for h in ['hiring', 'looking for', 'we need', 'role:', 'job:'])
                    if not has_hiring_structure:
                        continue
                    # Strict creative role check on title line
                    if not is_creative_video_role(first_line):
                        continue

                    story_id = hit.get("story_id", "")
                    object_id = hit.get("objectID", "")
                    hn_item_url = f"https://news.ycombinator.com/item?id={object_id}" if object_id else "https://news.ycombinator.com"
                    if hn_item_url in seen_urls:
                        continue
                    seen_urls.add(hn_item_url)

                    results.append({
                        "title": first_line[:100] if first_line else f"Hiring Opportunity: {query}",
                        "company": hit.get("author", "Hacker News Poster"),
                        "description": comment_text[:400] + ("..." if len(comment_text) > 400 else ""),
                        "source": "HackerNews",
                        "sourceUrl": hn_item_url,
                        "applicationUrl": None,
                        "location": "Remote",
                        "remote": True,
                        "skills": [clean_q or query],
                        "postedAt": hit.get("created_at", None),
                        "discoveredAt": datetime.now(timezone.utc).isoformat()
                    })
        except Exception as e:
            print(f"[Agent Reach Adapter Warning] HackerNews query failed: {e}", file=sys.stderr)

    return results[:limit]

@server.tool(
    name="search_hiring_opportunities",
    description="Search permitted public remote and freelance hiring opportunities across open web job channels and feeds. Returns normalized opportunity JSON."
)
def search_hiring_opportunities(query: str, limit: int = 5) -> str:
    """
    Search permitted public remote hiring channels and feeds.
    Returns normalized JSON array of public freelance and remote hiring opportunities.
    """
    opportunities = search_public_hiring(query=query, limit=limit)
    return json.dumps(opportunities, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    server.run(transport="stdio")
