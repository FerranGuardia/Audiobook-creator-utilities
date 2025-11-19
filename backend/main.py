"""
Backend API - TTS and Web Scraper
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import edge_tts
import asyncio
import html
import uuid
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import cloudscraper
import re
import time
import random
import json
import threading
from typing import Dict
from datetime import datetime

app = FastAPI(title="Audiobook Creator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Output directory
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AndrewNeural"
    rate: int = 0
    pitch: int = 0
    volume: int = 0

def build_ssml(text: str, rate: int = 0, pitch: int = 0, volume: int = 0) -> str:
    """Build SSML with voice controls"""
    if rate == 0 and pitch == 0 and volume == 0:
        return text
    
    prosody_attrs = []
    if rate != 0:
        prosody_attrs.append(f'rate="{rate:+.0f}%"')
    if pitch != 0:
        prosody_attrs.append(f'pitch="{pitch:+.0f}%"')
    if volume != 0:
        prosody_attrs.append(f'volume="{volume:+.0f}%"')
    
    escaped_text = html.escape(text)
    ssml = f'<speak><prosody {" ".join(prosody_attrs)}>{escaped_text}</prosody></speak>'
    return ssml

@app.get("/")
async def root():
    return {"message": "TTS API", "status": "running"}

@app.get("/api/voices")
async def get_voices(locale: Optional[str] = None):
    """Get list of available voices"""
    try:
        voices = await edge_tts.list_voices()
        if locale:
            # If "en-US", "en-GB", or "en", include all English voices
            if locale == "en-US" or locale == "en-GB" or locale == "en":
                voices = [v for v in voices if v["Locale"].startswith("en-")]
            else:
                voices = [v for v in voices if v["Locale"] == locale]
        return {"voices": voices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
async def generate_audio(request: TTSRequest):
    """Generate audio from text"""
    try:
        output_file = OUTPUT_DIR / f"{uuid.uuid4()}.mp3"
        
        ssml_text = build_ssml(request.text, request.rate, request.pitch, request.volume)
        communicate = edge_tts.Communicate(text=ssml_text, voice=request.voice)
        await communicate.save(str(output_file))
        
        return FileResponse(
            path=str(output_file),
            media_type="audio/mpeg",
            filename=output_file.name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Scraper endpoints
class ScrapeRequest(BaseModel):
    url: str
    base_url: Optional[str] = None
    start_url: Optional[str] = None
    start_chapter: Optional[int] = 1
    end_chapter: Optional[int] = None
    num_chapters: Optional[int] = None
    batch_size: Optional[int] = 10
    chapter_urls: Optional[List[str]] = None  # For importing URLs

class ChapterResult(BaseModel):
    chapter_number: int
    title: str
    content: str
    url: str

def clean_text(text: str) -> str:
    """Clean and format the scraped text (replica of original scraper)"""
    if not text:
        return ""
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Remove common webnovel site elements
    text = re.sub(r'Chapter \d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Next Chapter|Previous Chapter|Table of Contents|Advertisement', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Please enable JavaScript', '', text, flags=re.IGNORECASE)
    
    # Remove URLs
    text = re.sub(r'http\S+', '', text)
    
    # Remove email addresses
    text = re.sub(r'\S+@\S+', '', text)
    
    # Clean up multiple newlines
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    
    # Remove HTML entities
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&quot;', '"')
    text = text.replace('&amp;', '&')
    
    # Strip and return
    return text.strip()

def get_novel_title(soup: BeautifulSoup, url: str) -> Optional[str]:
    """Extract novel title from the page"""
    try:
        # Method 1: Look for title in meta tags
        title_tag = soup.find('meta', property='og:title')
        if title_tag and title_tag.get('content'):
            title = title_tag.get('content')
            title = re.sub(r'\s*-\s*NovelBin.*$', '', title, flags=re.I)
            title = re.sub(r'\s*-\s*Read.*$', '', title, flags=re.I)
            if title:
                return title.strip()
        
        # Method 2: Look for h1 with novel title
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
            if title and len(title) < 200:
                return title
        
        # Method 3: Extract from URL
        match = re.search(r'/b/([^/]+)', url)
        if match:
            title = match.group(1).replace('-', ' ').title()
            return title
        
        # Method 4: Page title tag
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text(strip=True)
            title = re.sub(r'\s*-\s*NovelBin.*$', '', title, flags=re.I)
            title = re.sub(r'\s*-\s*Read.*$', '', title, flags=re.I)
            if title:
                return title.strip()
        
        return None
    except:
        return None

def extract_chapter_title(soup: BeautifulSoup, novel_title: Optional[str] = None) -> Optional[str]:
    """Extract chapter title from soup object (replica of original)"""
    chapter_title = None
    
    # Try various selectors for chapter title
    title_selectors = [
        'h1.chapter-title', 'h1#chapter-title', 'h2.chapter-title',
        'div.chapter-title h1', 'div.chapter-title h2',
        'h1.chr-title', 'h1#chr-title',
        'h2.chapter-heading', 'div.chapter-heading',
        'div.chr-title h1', 'div.chr-title h2',
        'div.chapter-header h1', 'div.chapter-header h2',
    ]
    
    for selector in title_selectors:
        title_elem = soup.select_one(selector)
        if title_elem:
            title_text = title_elem.get_text(strip=True)
            if title_text and len(title_text) < 200:
                if novel_title and title_text.lower() == novel_title.lower():
                    continue
                if not re.search(r'novelbin|read online|table of contents|home|novel$|^novel\s', title_text, re.I):
                    title_text = re.sub(r'^Chapter\s+\d+[:\s]+', '', title_text, flags=re.I)
                    if title_text and len(title_text) > 2:
                        chapter_title = title_text
                        break
    
    # If still no title, look for h1/h2 within content area
    if not chapter_title:
        content_area = soup.select_one('div.chapter-content, div#chapter-content, div.chapter-body, div#chapter-body, div#chr-content, div.chr-c, article, div.read-content')
        if content_area:
            for heading in content_area.find_all(['h1', 'h2', 'h3'], limit=3):
                title_text = heading.get_text(strip=True)
                if title_text and len(title_text) < 200 and len(title_text) > 2:
                    if novel_title and title_text.lower() == novel_title.lower():
                        continue
                    if re.search(r'chapter|episode|part', title_text, re.I) or len(title_text) < 100:
                        title_text = re.sub(r'^Chapter\s+\d+[:\s]+', '', title_text, flags=re.I)
                        if title_text:
                            chapter_title = title_text
                            break
    
    # If still no title, try all h1/h2 but exclude novel title
    if not chapter_title:
        for heading in soup.find_all(['h1', 'h2'], limit=5):
            title_text = heading.get_text(strip=True)
            if title_text and len(title_text) < 200 and len(title_text) > 2:
                if novel_title and title_text.lower() == novel_title.lower():
                    continue
                if not re.search(r'novelbin|read online|table of contents|home|menu|navigation|^novel\s', title_text, re.I):
                    if re.search(r'chapter\s+\d+|episode\s+\d+', title_text, re.I) or \
                       (heading.find_parent(['div', 'article'], class_=re.compile('content|chapter|read', re.I))):
                        title_text = re.sub(r'^Chapter\s+\d+[:\s]+', '', title_text, flags=re.I)
                        if title_text:
                            chapter_title = title_text
                            break
    
    return chapter_title

def extract_chapter_content(soup: BeautifulSoup, url: str) -> tuple[str, Optional[str]]:
    """Extract chapter content and title from soup object (replica of original)"""
    novel_title = get_novel_title(soup, url)
    chapter_title = extract_chapter_title(soup, novel_title)
    
    # Try to extract from URL if no title found
    if not chapter_title:
        match = re.search(r'chapter[_-]\d+[_-](.+)', url, re.I)
        if match:
            title_from_url = match.group(1).replace('-', ' ').title()
            if len(title_from_url) > 3 and not re.match(r'^\d+$', title_from_url):
                chapter_title = title_from_url
    
    # Content selectors (prioritize specific ones)
    content_selectors = [
        'div.chapter-content', 'div#chapter-content', 'div.chapter-body',
        'div#chapter-body', 'div.content', 'div#content', 'div.text-content',
        'article', 'div.read-content', 'div.chapter-text',
        'div#chr-content', 'div.chr-c', 'div#chaptercontent'
    ]
    
    content = None
    for selector in content_selectors:
        content = soup.select_one(selector)
        if content:
            break
    
    if not content:
        content = soup.find('div', class_=re.compile('content|chapter|text', re.I))
    
    if not content:
        content = soup.find('body')
    
    if content:
        # For novelbin.com, try specific selectors
        novelbin_content = soup.select_one('div#chr-content, div.chr-c, div#chaptercontent, div.chapter-content')
        if novelbin_content:
            content = novelbin_content
        
        paragraphs = content.find_all(['p', 'div'])
        text_parts = []
        
        for p in paragraphs:
            text = p.get_text(strip=True)
            if text and len(text) > 20:
                if not re.search(r'previous|next|chapter|table of contents|advertisement', text, re.I):
                    text_parts.append(text)
        
        # If no paragraphs found, try getting all text
        if not text_parts:
            text = content.get_text(separator='\n', strip=True)
            if text and len(text) > 50:
                lines = [line.strip() for line in text.split('\n') if line.strip() and len(line.strip()) > 20]
                text_parts = lines
        
        full_text = '\n\n'.join(text_parts)
        cleaned_content = clean_text(full_text)
        return cleaned_content, chapter_title
    
    return "", chapter_title

def scrape_single_chapter_url(chapter_url: str, scraper) -> tuple[Optional[str], Optional[str]]:
    """Scrape a single chapter from URL (replica of original)"""
    try:
        # Add random delay to be more human-like
        time.sleep(random.uniform(1.5, 3.0))
        
        try:
            response = scraper.get(chapter_url, timeout=20, allow_redirects=True)
        except requests.exceptions.Timeout:
            return None, None
        except requests.exceptions.ConnectionError:
            return None, None
        except requests.exceptions.RequestException:
            return None, None
        
        if response.status_code == 403:
            # Try again with longer delay
            time.sleep(random.uniform(3, 5))
            scraper = cloudscraper.create_scraper()
            try:
                response = scraper.get(chapter_url, timeout=20, allow_redirects=True)
            except Exception:
                return None, None
        
        if response.status_code != 200:
            return None, None
        
        soup = BeautifulSoup(response.content, 'html.parser')
        content, chapter_title = extract_chapter_content(soup, chapter_url)
        
        if not content:
            return None, None
        
        return content, chapter_title
    
    except Exception:
        return None, None

@app.post("/api/get-chapter-urls")
async def get_chapter_urls(request: ScrapeRequest):
    """Get list of chapter URLs from a webnovel (replica of original)"""
    try:
        scraper = cloudscraper.create_scraper()
        start_url = request.start_url or request.url
        base_url = request.base_url or (start_url.rsplit('/', 1)[0] if '/' in start_url else start_url)
        
        time.sleep(random.uniform(2, 4))
        response = scraper.get(start_url, timeout=20, allow_redirects=True)
        
        if response.status_code == 403:
            # Try accessing base URL first
            try:
                scraper.get(base_url, timeout=20)
                time.sleep(random.uniform(2, 3))
                scraper = cloudscraper.create_scraper()
                response = scraper.get(start_url, timeout=20, allow_redirects=True)
            except Exception:
                pass
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Failed to fetch: HTTP {response.status_code}")
        
        soup = BeautifulSoup(response.content, 'html.parser')
        novel_title = get_novel_title(soup, start_url)
        
        chapter_links = []
        seen_urls = set()
        
        # Find chapter links
        links = soup.find_all('a', href=True)
        for link in links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            is_chapter = False
            if re.search(r'chapter|ch\.|episode', href, re.I) or \
               re.search(r'chapter|ch\.|episode', text, re.I):
                is_chapter = True
            
            if re.search(r'/chapter[_-]?\d+', href, re.I):
                is_chapter = True
            
            if is_chapter:
                if href.startswith('/'):
                    full_url = base_url + href
                elif href.startswith('http'):
                    full_url = href
                elif not href.startswith('#'):
                    full_url = base_url + '/' + href.lstrip('/')
                else:
                    continue
                
                full_url = full_url.split('#')[0].split('?')[0]
                if full_url not in seen_urls and 'chapter' in full_url.lower():
                    seen_urls.add(full_url)
                    chapter_links.append(full_url)
        
        return {
            "novel_title": novel_title,
            "chapter_urls": chapter_links,
            "count": len(chapter_links)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting chapter URLs: {str(e)}")

@app.post("/api/scrape", response_model=List[dict])
async def scrape_chapters(request: ScrapeRequest):
    """Scrape chapters from URLs (replica of original scraper logic)"""
    try:
        scraper = cloudscraper.create_scraper()
        results = []
        
        # If chapter_urls provided, use them directly
        if request.chapter_urls:
            chapter_urls = request.chapter_urls
            # Extract chapter numbers from URLs
            def extract_chapter_num(url):
                match = re.search(r'chapter[_-]?(\d+)', url, re.I)
                return int(match.group(1)) if match else 9999
            
            # Sort by chapter number
            chapter_urls_with_nums = [(extract_chapter_num(url), url) for url in chapter_urls]
            chapter_urls_with_nums.sort(key=lambda x: x[0])
            chapter_urls = [url for _, url in chapter_urls_with_nums]
            
            # Apply range filters if specified
            if request.start_chapter or request.end_chapter or request.num_chapters:
                filtered_urls = []
                for url in chapter_urls:
                    ch_num = extract_chapter_num(url)
                    if ch_num == 9999:
                        continue
                    
                    if request.start_chapter and ch_num < request.start_chapter:
                        continue
                    if request.end_chapter and ch_num > request.end_chapter:
                        continue
                    if request.num_chapters:
                        if len(filtered_urls) >= request.num_chapters:
                            break
                    
                    filtered_urls.append(url)
                chapter_urls = filtered_urls
        else:
            # Generate URLs based on range
            base_url = request.url.rsplit('/', 1)[0] if '/' in request.url else request.url
            end_chapter = request.end_chapter or (request.start_chapter + (request.num_chapters or 10) - 1)
            
            chapter_urls = []
            for chapter_num in range(request.start_chapter, end_chapter + 1):
                urls_to_try = [
                    f"{request.url}/{chapter_num}",
                    f"{request.url}-{chapter_num}",
                    f"{request.url}-chapter-{chapter_num}",
                    f"{request.url}/chapter-{chapter_num}",
                    f"{base_url}/{chapter_num}",
                    f"{base_url}/chapter-{chapter_num}",
                ]
                chapter_urls.extend(urls_to_try)
        
        # Scrape each chapter
        for i, chapter_url in enumerate(chapter_urls, 1):
            chapter_num = i
            match = re.search(r'chapter[_-]?(\d+)', chapter_url, re.I)
            if match:
                chapter_num = int(match.group(1))
            
            content, chapter_title = scrape_single_chapter_url(chapter_url, scraper)
            
            if content:
                results.append({
                    "chapter_number": chapter_num,
                    "title": chapter_title or f"Chapter {chapter_num}",
                    "content": content,
                    "url": chapter_url
                })
            else:
                results.append({
                    "chapter_number": chapter_num,
                    "title": f"Chapter {chapter_num} (Not Found)",
                    "content": "",
                    "url": chapter_url,
                    "error": "Could not extract content"
                })
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping error: {str(e)}")

@app.post("/api/scrape-single")
async def scrape_single_chapter(request: ScrapeRequest):
    """Scrape a single chapter from URL"""
    try:
        scraper = cloudscraper.create_scraper()
        content, chapter_title = scrape_single_chapter_url(request.url, scraper)
        
        if not content:
            raise HTTPException(status_code=400, detail="Could not extract chapter content")
        
        return {
            "title": chapter_title or "Chapter",
            "content": content,
            "url": request.url
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/save-chapters-batch")
async def save_chapters_batch(chapters: List[dict], batch_size: int = 10, output_folder: str = "scraped_chapters"):
    """Save chapters in batches (replica of original)"""
    try:
        output_path = Path(output_folder)
        output_path.mkdir(exist_ok=True)
        
        saved_files = []
        
        for chunk_start in range(0, len(chapters), batch_size):
            chunk_end = min(chunk_start + batch_size, len(chapters))
            chunk = chapters[chunk_start:chunk_end]
            
            # Create filename for this chunk
            filename = f"chapters_{chunk_start+1}_to_{chunk_end}.txt"
            filepath = output_path / filename
            
            # Combine all chapters in this chunk
            combined_text = []
            for chapter in chunk:
                combined_text.append(f"=== Chapter {chapter.get('chapter_number', chunk_start + chunk.index(chapter) + 1)} ===\n\n")
                if chapter.get('title'):
                    combined_text.append(f"{chapter['title']}\n\n")
                combined_text.append(chapter.get('content', ''))
                combined_text.append("\n\n")
            
            # Write to file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(''.join(combined_text))
            
            saved_files.append({
                "filename": filename,
                "path": str(filepath),
                "chapters_count": len(chunk),
                "characters": len(''.join(combined_text))
            })
        
        return {
            "saved_files": saved_files,
            "total_chapters": len(chapters),
            "total_files": len(saved_files)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving chapters: {str(e)}")

# All-in-One Processing State
processing_state = {
    "status": "idle",  # idle, processing, paused, completed, error
    "current": 0,
    "total": 0,
    "current_chapter": None,
    "completed_batches": 0,
    "total_batches": 0,
    "error": None,
    "lock": threading.Lock(),
    "pause_event": threading.Event(),
    "stop_event": threading.Event(),
    "thread": None
}

AUDIO_OUTPUT_DIR = Path("output/audio")
AUDIO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class AllInOneRequest(BaseModel):
    base_url: Optional[str] = None
    start_url: str
    start_chapter: int = 1
    end_chapter: Optional[int] = None
    num_chapters: Optional[int] = None
    batch_size: int = 10
    voice: str = "en-US-AndrewNeural"
    rate: int = 0
    pitch: int = 0
    volume: int = 0

def process_all_in_one_worker(request: AllInOneRequest):
    """Worker thread to process chapters in batch"""
    global processing_state
    
    try:
        with processing_state["lock"]:
            processing_state["status"] = "processing"
            processing_state["error"] = None
            processing_state["stop_event"].clear()
            processing_state["pause_event"].clear()
        
        scraper = cloudscraper.create_scraper()
        
        # Calculate total chapters
        if request.end_chapter:
            total_chapters = request.end_chapter - request.start_chapter + 1
        elif request.num_chapters:
            total_chapters = request.num_chapters
        else:
            total_chapters = 1
        
        total_batches = (total_chapters + request.batch_size - 1) // request.batch_size
        
        with processing_state["lock"]:
            processing_state["total"] = total_chapters
            processing_state["total_batches"] = total_batches
        
        # Get chapter URLs first
        start_url = request.start_url
        base_url = request.base_url or (start_url.rsplit('/', 1)[0] if '/' in start_url else start_url)
        
        # Try to get all chapter URLs
        try:
            time.sleep(random.uniform(2, 4))
            response = scraper.get(start_url, timeout=20, allow_redirects=True)
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                chapter_links = []
                seen_urls = set()
                
                links = soup.find_all('a', href=True)
                for link in links:
                    href = link.get('href', '')
                    if re.search(r'/chapter[_-]?\d+', href, re.I):
                        if href.startswith('/'):
                            full_url = base_url + href
                        elif href.startswith('http'):
                            full_url = href
                        elif not href.startswith('#'):
                            full_url = base_url + '/' + href.lstrip('/')
                        else:
                            continue
                        
                        full_url = full_url.split('#')[0].split('?')[0]
                        if full_url not in seen_urls and 'chapter' in full_url.lower():
                            seen_urls.add(full_url)
                            chapter_links.append(full_url)
                
                # Extract chapter numbers and sort
                def extract_chapter_num(url):
                    match = re.search(r'chapter[_-]?(\d+)', url, re.I)
                    return int(match.group(1)) if match else 9999
                
                chapter_urls_with_nums = [(extract_chapter_num(url), url) for url in chapter_links]
                chapter_urls_with_nums.sort(key=lambda x: x[0])
                chapter_urls = [url for _, url in chapter_urls_with_nums if 9999 > _ >= request.start_chapter]
                
                if request.end_chapter:
                    chapter_urls = [url for url in chapter_urls if extract_chapter_num(url) <= request.end_chapter]
                elif request.num_chapters:
                    chapter_urls = chapter_urls[:request.num_chapters]
        except Exception as e:
            print(f"Error getting chapter URLs: {e}")
            chapter_urls = []
        
        # If no URLs found, generate them
        if not chapter_urls:
            chapter_urls = []
            for ch_num in range(request.start_chapter, request.start_chapter + total_chapters):
                urls_to_try = [
                    f"{start_url}/{ch_num}",
                    f"{start_url}-{ch_num}",
                    f"{start_url}-chapter-{ch_num}",
                    f"{start_url}/chapter-{ch_num}",
                    f"{base_url}/{ch_num}",
                    f"{base_url}/chapter-{ch_num}",
                ]
                chapter_urls.extend(urls_to_try)
        
        # Process in batches
        current_batch = []
        batch_num = 0
        
        for i, chapter_url in enumerate(chapter_urls):
            # Check for stop
            if processing_state["stop_event"].is_set():
                with processing_state["lock"]:
                    processing_state["status"] = "idle"
                return
            
            # Check for pause
            if processing_state["pause_event"].is_set():
                while processing_state["pause_event"].is_set() and not processing_state["stop_event"].is_set():
                    time.sleep(0.5)
            
            if processing_state["stop_event"].is_set():
                return
            
            # Scrape chapter
            content, chapter_title = scrape_single_chapter_url(chapter_url, scraper)
            
            if not content:
                continue
            
            chapter_num = i + request.start_chapter
            match = re.search(r'chapter[_-]?(\d+)', chapter_url, re.I)
            if match:
                chapter_num = int(match.group(1))
            
            with processing_state["lock"]:
                processing_state["current"] = i + 1
                processing_state["current_chapter"] = {
                    "chapter_number": chapter_num,
                    "title": chapter_title or f"Chapter {chapter_num}",
                    "url": chapter_url
                }
            
            # Generate audio
            try:
                ssml_text = build_ssml(content, request.rate, request.pitch, request.volume)
                communicate = edge_tts.Communicate(text=ssml_text, voice=request.voice)
                audio_file = AUDIO_OUTPUT_DIR / f"chapter_{chapter_num}_{uuid.uuid4().hex[:8]}.mp3"
                asyncio.run(communicate.save(str(audio_file)))
                
                current_batch.append({
                    "chapter_number": chapter_num,
                    "title": chapter_title or f"Chapter {chapter_num}",
                    "audio_file": audio_file
                })
            except Exception as e:
                print(f"Error generating audio for chapter {chapter_num}: {e}")
                continue
            
            # When batch is complete, combine and save
            if len(current_batch) >= request.batch_size or i == len(chapter_urls) - 1:
                batch_num += 1
                try:
                    combined_audio = AUDIO_OUTPUT_DIR / f"batch_{batch_num}_chapters_{current_batch[0]['chapter_number']}_to_{current_batch[-1]['chapter_number']}.mp3"
                    
                    # Try to use pydub for combining, fallback to simple method
                    try:
                        from pydub import AudioSegment
                        combined = AudioSegment.empty()
                        for item in current_batch:
                            if item["audio_file"].exists():
                                audio = AudioSegment.from_mp3(str(item["audio_file"]))
                                combined += audio
                        combined.export(str(combined_audio), format="mp3")
                    except ImportError:
                        # Fallback: concatenate using binary append (simple but works)
                        with open(combined_audio, 'wb') as outfile:
                            for item in current_batch:
                                if item["audio_file"].exists():
                                    with open(item["audio_file"], 'rb') as infile:
                                        outfile.write(infile.read())
                    
                    # Clean up individual chapter files
                    for item in current_batch:
                        if item["audio_file"].exists():
                            item["audio_file"].unlink()
                    
                    with processing_state["lock"]:
                        processing_state["completed_batches"] = batch_num
                    
                except Exception as e:
                    print(f"Error combining batch {batch_num}: {e}")
                
                current_batch = []
        
        with processing_state["lock"]:
            processing_state["status"] = "completed"
            processing_state["current"] = total_chapters
    
    except Exception as e:
        with processing_state["lock"]:
            processing_state["status"] = "error"
            processing_state["error"] = str(e)
        print(f"Error in processing worker: {e}")

@app.post("/api/process-all-in-one")
async def process_all_in_one(request: AllInOneRequest):
    """Start all-in-one processing"""
    global processing_state
    
    with processing_state["lock"]:
        if processing_state["status"] == "processing":
            raise HTTPException(status_code=400, detail="Processing already in progress")
        
        # Reset state
        processing_state["status"] = "idle"
        processing_state["current"] = 0
        processing_state["total"] = 0
        processing_state["current_chapter"] = None
        processing_state["completed_batches"] = 0
        processing_state["total_batches"] = 0
        processing_state["error"] = None
        processing_state["stop_event"].clear()
        processing_state["pause_event"].clear()
        
        # Start worker thread
        thread = threading.Thread(target=process_all_in_one_worker, args=(request,))
        thread.daemon = True
        thread.start()
        processing_state["thread"] = thread
    
    return {"message": "Processing started", "status": "processing"}

@app.get("/api/process-status")
async def get_process_status():
    """Get current processing status"""
    global processing_state
    
    with processing_state["lock"]:
        return {
            "status": processing_state["status"],
            "current": processing_state["current"],
            "total": processing_state["total"],
            "current_chapter": processing_state["current_chapter"],
            "completed_batches": processing_state["completed_batches"],
            "total_batches": processing_state["total_batches"],
            "error": processing_state["error"]
        }

@app.post("/api/process-pause")
async def pause_process():
    """Pause processing"""
    global processing_state
    
    with processing_state["lock"]:
        if processing_state["status"] != "processing":
            raise HTTPException(status_code=400, detail="No processing in progress")
        
        processing_state["pause_event"].set()
        processing_state["status"] = "paused"
    
    return {"message": "Processing paused", "status": "paused"}

@app.post("/api/process-resume")
async def resume_process():
    """Resume processing"""
    global processing_state
    
    with processing_state["lock"]:
        if processing_state["status"] != "paused":
            raise HTTPException(status_code=400, detail="Processing is not paused")
        
        processing_state["pause_event"].clear()
        processing_state["status"] = "processing"
    
    return {"message": "Processing resumed", "status": "processing"}

@app.post("/api/process-stop")
async def stop_process():
    """Stop processing"""
    global processing_state
    
    with processing_state["lock"]:
        processing_state["stop_event"].set()
        processing_state["pause_event"].clear()
        processing_state["status"] = "idle"
    
    return {"message": "Processing stopped", "status": "idle"}

@app.get("/api/list-audio-files")
async def list_audio_files():
    """List generated audio files"""
    try:
        files = []
        for file_path in AUDIO_OUTPUT_DIR.glob("*.mp3"):
            files.append({
                "filename": file_path.name,
                "size": f"{file_path.stat().st_size / (1024*1024):.2f} MB",
                "created": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
            })
        
        files.sort(key=lambda x: x["created"], reverse=True)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download-audio/{filename}")
async def download_audio(filename: str):
    """Download an audio file"""
    file_path = AUDIO_OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=str(file_path),
        media_type="audio/mpeg",
        filename=filename
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
