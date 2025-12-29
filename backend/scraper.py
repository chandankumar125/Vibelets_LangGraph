import os
import re
import json
import time
import logging
import requests
import warnings
from typing import List, Dict, Tuple, Optional
from urllib.parse import urljoin, urlparse, parse_qs
from bs4 import BeautifulSoup
from firecrawl import Firecrawl
from PIL import Image
from io import BytesIO
from config import Config

# Suppress urllib3 SSL warnings (InsecureRequestWarning)
from urllib3.exceptions import InsecureRequestWarning
warnings.filterwarnings('ignore', category=InsecureRequestWarning)

logger = logging.getLogger(__name__)


class ProductScraper:
    """
    Universal Product Scraper (Production-Grade)
    Works for Amazon, Flipkart, Shopify & MOST ecommerce sites
    """

    def __init__(self):
        self.app = Firecrawl(api_key=Config.FIRECRAWL_API_KEY)
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0 Safari/537.36"
            )
        }

    # =====================================================
    # ENTRY
    # =====================================================
    def scrape_url(self, url: str) -> Dict:
        if not url.startswith("http"):
            url = "https://" + url

        start = time.perf_counter()
        logger.info(f"▶️ Scraping: {url}")

        html, markdown = "", ""
        data: Dict = {}

        # -------------------------------------------------
        # 1. FIRECRAWL (HTML + MARKDOWN)
        # -------------------------------------------------
        try:
            doc = self.app.scrape(
                url,
                formats=["html", "markdown"]
            )
            
            # Debug: Log the type and structure
            logger.info(f"🔍 Firecrawl response type: {type(doc)}")
            logger.info(f"🔍 Firecrawl response dir: {[x for x in dir(doc) if not x.startswith('_')]}")
            
            # Try multiple ways to access the data
            html = ""
            markdown = ""
            
            # Method 1: Direct attribute access
            if hasattr(doc, 'html') and doc.html:
                html = doc.html
                logger.info("✅ Got HTML from doc.html")
            # Method 2: Dictionary-style access
            elif isinstance(doc, dict) and 'html' in doc:
                html = doc['html']
                logger.info("✅ Got HTML from doc['html']")
            # Method 3: Check for 'data' attribute (some SDKs wrap it)
            elif hasattr(doc, 'data') and isinstance(doc.data, dict) and 'html' in doc.data:
                html = doc.data['html']
                logger.info("✅ Got HTML from doc.data['html']")
            else:
                logger.warning("⚠️ Could not extract HTML from Firecrawl response")
            
            # Same for markdown
            if hasattr(doc, 'markdown') and doc.markdown:
                markdown = doc.markdown
                logger.info("✅ Got Markdown from doc.markdown")
            elif isinstance(doc, dict) and 'markdown' in doc:
                markdown = doc['markdown']
                logger.info("✅ Got Markdown from doc['markdown']")
            elif hasattr(doc, 'data') and isinstance(doc.data, dict) and 'markdown' in doc.data:
                markdown = doc.data['markdown']
                logger.info("✅ Got Markdown from doc.data['markdown']")
            
            # If still no HTML, raise exception to trigger fallback
            if not html or len(html) < 100:
                raise Exception("Firecrawl returned empty or incomplete HTML")
                
        except Exception as e:
            logger.warning(f"⚠️ Firecrawl failed → fallback requests: {e}")
            r = requests.get(url, headers=self.headers, timeout=10, verify=False)
            r.raise_for_status()
            html = r.text
            logger.info("✅ Successfully fell back to requests library")

        # -------------------------------------------------
        # 2. STRUCTURED SOURCES
        # -------------------------------------------------
        data.update(self.extract_json_ld(html))
        data.update(self.extract_meta(html))
        data.update(self.extract_js_state(html))

        # -------------------------------------------------
        # 2.1 FLIPKART SPECIFIC (MANUAL OVERRIDE)
        # -------------------------------------------------
        if "flipkart" in url:
             data.update(self.extract_flipkart_data(html))
             if data.get("variants"):
                  # Pre-populate variants list for merging later
                  pass

        # -------------------------------------------------
        # 2.2 AMAZON SPECIFIC (MANUAL OVERRIDE)
        # -------------------------------------------------
        if "amazon" in url:
             amazon_data = self.extract_amazon_data(html)
             data.update(amazon_data)
             logger.info(f"Amazon extraction found {len(amazon_data.get('variants', []))} variants")

        # -------------------------------------------------
        # 3. PRICE (WEIRD CLASS SAFE)
        # -------------------------------------------------
        if not data.get("price"):
            data["price"] = self.extract_price_anywhere(html)

        # -------------------------------------------------
        # 4. SKU
        # -------------------------------------------------
        data["sku"] = data.get("sku") or self.extract_sku(html, url)

        # -------------------------------------------------
        # 5. VARIANTS
        # -------------------------------------------------
        variants = []
        variants += data.get("variants", [])
        variants += self.extract_variants_json_ld(html)
        variants += self.extract_shopify_variants(html)
        variants += self.extract_dom_variants(html)
        logger.info(f"Total variants before merge: {len(variants)}")
        data["variants"] = self.merge_variants(variants)

        # -------------------------------------------------
        # 6. IMAGES
        # -------------------------------------------------
        images = []
        images += data.get("images", [])
        images += self.extract_images_brute_force(html)
        images = self.normalize_images(images, url)

        downloaded, hero = self.download_images(images)

        # -------------------------------------------------
        # 7. DESCRIPTION
        # -------------------------------------------------
        description = data.get("description", "")
        if not description and markdown:
            description = markdown[:500].replace("\n", " ")

        confidence = self.calculate_confidence(data)

        logger.info(f"✅ Done in {time.perf_counter() - start:.2f}s")

        return {
            "url": url,
            "title": data.get("title", "Unknown Product"),
            "description": description,
            "sku": data.get("sku", ""),
            "price": data.get("price", "Price not found"),
            "variants": data.get("variants", []),
            "variants_count": len(data.get("variants", [])),
            "images": images,
            "downloaded_images": downloaded,
            "main_image": hero,
            "confidence": confidence,
            "raw_text": markdown[:5000]
        }

    # =====================================================
    # PRICE — CLASS NAME INDEPENDENT
    # =====================================================
    def extract_price_anywhere(self, html: str) -> Optional[str]:
        soup = BeautifulSoup(html, "html.parser")

        price_regex = re.compile(r'(₹|\$|€|£|Rs\.?)\s?[\d,]+(?:\.\d{2})?')

        for el in soup.find_all(string=price_regex):
            txt = el.strip()
            if len(txt) < 25 and not any(x in txt.lower() for x in ["off", "save", "emi"]):
                parent = el.parent
                if parent.name not in ["s", "del", "strike"]:
                    return txt
        return None

    # =====================================================
    # FLIPKART SPECIFIC (USER PROVIDED CLASSES)
    # =====================================================
    def extract_flipkart_data(self, html: str) -> Dict:
        """
        Extracts data using specific classes observed in user screenshots.
        Classes: 
          - Price: .hZ3P6w (and .bnqy13)
          - Specs/Variants: .UD6lKn, .W8q4RQ
          - Description: Multiple possible selectors
        """
        soup = BeautifulSoup(html, "html.parser")
        data = {}

        # 1. Price
        # Look for the specific price class from screenshot
        price_el = soup.find("div", class_="hZ3P6w")
        if price_el:
            data["price"] = price_el.get_text(strip=True)

        # 2. Description
        # Try multiple selectors for Flipkart description
        description = None
        
        # Method 1: Look for divs with class containing 'description' or 'desc'
        desc_candidates = soup.find_all("div", class_=re.compile(r'description|desc|about', re.I))
        for candidate in desc_candidates:
            text = candidate.get_text(strip=True)
            # Filter out short texts and navigation elements
            if len(text) > 50 and not any(x in text.lower() for x in ['add to cart', 'buy now', 'share']):
                description = text
                break
        
        # Method 2: Look for specific Flipkart description structure
        if not description:
            # Look for the "Product Description" heading and get the next sibling
            desc_heading = soup.find(string=re.compile(r'Product Description', re.I))
            if desc_heading:
                # Navigate to parent and find description content
                parent = desc_heading.find_parent()
                if parent:
                    # Try to find the description in the next sibling or within parent
                    next_elem = parent.find_next_sibling()
                    if next_elem:
                        description = next_elem.get_text(strip=True)
                    else:
                        # Look within the parent for description content
                        desc_div = parent.find_next("div")
                        if desc_div:
                            description = desc_div.get_text(strip=True)
        
        # Method 3: Look for common Flipkart description classes
        if not description:
            common_classes = ['_3WHvuP', '_2418kt', 'IFBSIx', '_1AN87F']
            for cls in common_classes:
                desc_el = soup.find("div", class_=cls)
                if desc_el:
                    text = desc_el.get_text(strip=True)
                    if len(text) > 50:
                        description = text
                        break
        
        if description:
            data["description"] = description

        # 3. Key Specs / Variants (ONLY storage, color, RAM - NOT display/specs)
        # Structure seen: .UD6lKn (Row) -> .W8q4RQ (Option)
        variants = []
        
        # Specifications to EXCLUDE from variants (these are product specs, not options)
        spec_keywords = [
            'display', 'screen', 'inch', 'cm', 'mm', 'retina', 'xdr', 'lcd', 'oled', 'amoled',
            'processor', 'chip', 'core', 'ghz', 'cpu', 'a19', 'a18', 'a17', 'a16', 'a15',
            'camera', 'mp', 'megapixel', 'lens', 'front camera', 'rear camera', '48mp', '12mp',
            'battery', 'mah', 'watt', 'charging', 'fast charging',
            'warranty', 'support', 'brand', 'super retina'
        ]
        
        for row in soup.find_all("div", class_="UD6lKn"):
            # Get the row text to check if it's a variant row or spec row
            row_text = row.get_text(strip=True).lower()
            
            # STRICT: Skip if this row contains specification keywords
            if any(keyword in row_text for keyword in spec_keywords):
                logger.debug(f"  ⊘ Skipping spec row: {row_text[:50]}")
                continue
            
            # STRICT: Only look for rows that explicitly mention storage/color/RAM
            # Reject anything that looks like a measurement (cm, inch, mm)
            if any(measurement in row_text for measurement in ['cm', 'inch', 'mm', '"', '″']):
                logger.debug(f"  ⊘ Skipping measurement row: {row_text[:50]}")
                continue
            
            # Only look for ACTUAL variant labels (Storage, Color, RAM)
            label_node = row.find(["span", "div"], string=re.compile(r'Storage|Color|RAM|Capacity|Memory|Variant', re.I))
            
            if not label_node:
                # Try finding label in children - but be VERY strict
                if "storage" in row_text or "color" in row_text or "ram" in row_text:
                    # Check it's not a spec description
                    if "internal" in row_text or "rom" in row_text or "memory" in row_text:
                        pass  # Continue to extract
                    else:
                        continue
                else:
                    continue
            
            # Find options in this row
            for idx, option in enumerate(row.find_all("div", class_="W8q4RQ")):
                txt = option.get_text(strip=True)
                if not txt:
                    continue
                
                # Additional filter: Skip if the option text contains spec keywords
                txt_lower = txt.lower()
                if any(keyword in txt_lower for keyword in spec_keywords):
                    logger.debug(f"  ⊘ Skipping spec option: {txt}")
                    continue
                
                # CRITICAL: Skip if it contains measurements (cm, inch, mm)
                if any(m in txt_lower for m in ['cm', 'inch', 'mm', '"', '″', '(']):
                    logger.debug(f"  ⊘ Skipping measurement option: {txt}")
                    continue
                
                # Only accept if it looks like a real variant
                # Storage: Must have GB/TB AND (ROM or Storage or just be a number+GB)
                is_storage = bool(re.search(r'\d+\s*(gb|tb)\s*(rom|storage)?$', txt_lower, re.I))
                # RAM: Must explicitly say RAM or Memory
                is_ram = bool(re.search(r'\d+\s*gb\s*(ram|memory)', txt_lower, re.I))
                # Color: Must match known color names
                is_color = any(color in txt_lower for color in [
                    'black', 'white', 'blue', 'red', 'green', 'yellow', 'pink', 'purple',
                    'gold', 'silver', 'grey', 'gray', 'orange', 'brown', 'lavender',
                    'midnight', 'starlight', 'sierra', 'graphite', 'rose', 'coral'
                ])
                
                if not (is_storage or is_ram or is_color):
                    logger.debug(f"  ⊘ Skipping non-variant option: {txt}")
                    continue
                
                # Try to extract SKU from data attributes or aria attributes
                sku = (option.get("data-sku") or 
                       option.get("data-id") or 
                       option.get("data-variant-id") or 
                       option.get("aria-label") or "")
                
                # If no SKU from attributes, generate one from text + index
                if not sku or len(sku) > 100:
                    # Use text + index as SKU
                    sku = f"FK-{txt.replace(' ', '-')[:15]}-{idx}"
                
                # Check availability - look for disabled class
                classes_str = ' '.join(option.get("class", []))
                available = "a-disabled" not in classes_str and "disabled" not in classes_str
                
                # Determine variant type
                variant_type = "Storage" if is_storage else ("RAM" if is_ram else "Color")
                
                variants.append({
                    "name": variant_type,
                    "value": txt,
                    "sku": sku,
                    "available": available
                })
                logger.debug(f"  ✓ Found variant: {variant_type} = {txt}")
        
        if variants:
            data["variants"] = variants
            logger.info(f"Flipkart extraction found {len(variants)} variants")

        return data

    # =====================================================
    # AMAZON SPECIFIC
    # =====================================================
    def extract_amazon_data(self, html: str) -> Dict:
        """
        Extracts data from Amazon product pages.
        Focuses on variant extraction (size, color, style options).
        """
        soup = BeautifulSoup(html, "html.parser")
        data = {}
        variants = []

        # Method 1: Look for variation buttons (common pattern)
        # Amazon uses various patterns like: li.swatchSelect, div.a-button-text, etc.
        
        # Size variations
        size_selectors = [
            "li.swatchSelect",  # Swatch-based selection
            "select#native_dropdown_selected_size_name option",  # Dropdown
            "span.selection"  # Some products use span
        ]
        
        for selector in size_selectors:
            elements = soup.select(selector)
            for elem in elements:
                text = elem.get_text(strip=True)
                if text and len(text) < 50 and text.lower() not in ['select', 'choose', 'size']:
                    # Extract data attributes for SKU
                    sku = (elem.get("data-defaultasin") or 
                           elem.get("data-asin") or 
                           elem.get("value") or "")
                    
                    # Check if available - look for both disabled class and "out of stock" text
                    classes = ' '.join(elem.get("class", []))
                    text_lower = text.lower()
                    available = ("unavailable" not in classes.lower() and 
                                "disabled" not in classes.lower() and
                                "out of stock" not in text_lower and
                                "currently unavailable" not in text_lower and
                                "sold out" not in text_lower)
                    
                    variants.append({
                        "name": "Size",
                        "value": text,
                        "sku": sku if sku and len(sku) < 50 else f"AMZ-SIZE-{text[:15]}",
                        "available": available
                    })

        # Method 2: Color/Style variations
        color_swatches = soup.select("li.imageSwatch, li.swatchAvailable")
        for swatch in color_swatches:
            # Get color name from title or aria-label
            color_name = (swatch.get("title") or 
                         swatch.get("aria-label") or 
                         swatch.get_text(strip=True))
            
            if color_name and len(color_name) < 100:
                # Clean up the text (Amazon often includes "Click to select")
                color_name = re.sub(r'Click to select|Click here to select', '', color_name, flags=re.I).strip()
                
                asin = swatch.get("data-defaultasin") or swatch.get("data-asin") or ""
                
                # Check availability - look for swatchUnavailable class or "out of stock" text
                swatch_classes = ' '.join(swatch.get("class", []))
                color_text = color_name.lower()
                available = ("swatchUnavailable" not in swatch_classes and
                           "out of stock" not in color_text and
                           "currently unavailable" not in color_text and
                           "sold out" not in color_text)
                
                variants.append({
                    "name": "Color/Style",
                    "value": color_name,
                    "sku": asin if asin else f"AMZ-COLOR-{color_name[:15]}",
                    "available": available
                })

        # Method 3: Variation dropdown (fallback)
        variation_selects = soup.find_all("select", id=re.compile(r'native_dropdown_selected_', re.I))
        for select in variation_selects:
            variation_type = select.get("id", "").replace("native_dropdown_selected_", "").replace("_name", "")
            for option in select.find_all("option"):
                value = option.get_text(strip=True)
                if value and value.lower() not in ['select', 'choose an option']:
                    # Check if this option is marked as disabled or has out of stock text
                    is_disabled = option.get("disabled") is not None
                    value_lower = value.lower()
                    has_stock_text = ("out of stock" in value_lower or 
                                     "currently unavailable" in value_lower or
                                     "sold out" in value_lower)
                    
                    variants.append({
                        "name": variation_type.title(),
                        "value": value,
                        "sku": option.get("value", ""),
                        "available": not (is_disabled or has_stock_text)
                    })

        if variants:
            data["variants"] = variants
            logger.info(f"Amazon scraper found {len(variants)} raw variants")

        return data


    # =====================================================
    # SKU
    # =====================================================
    def extract_sku(self, html: str, url: str) -> str:
        asin = re.search(r'/dp/([A-Z0-9]{10})', url)
        if asin:
            return asin.group(1)

        qs = parse_qs(urlparse(url).query)
        if "pid" in qs:
            return qs["pid"][0]

        soup = BeautifulSoup(html, "html.parser")
        sku = soup.find(attrs={"data-sku": True})
        if sku:
            return sku["data-sku"]

        match = re.search(r'SKU[:\s]+([A-Z0-9-_]+)', html, re.I)
        return match.group(1) if match else ""

    # =====================================================
    # VARIANTS
    # =====================================================
    def extract_variants_json_ld(self, html: str) -> List[dict]:
        variants = []
        scripts = re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.DOTALL)
        for s in scripts:
            try:
                js = json.loads(s)
                if js.get("hasVariant"):
                    for v in js["hasVariant"]:
                        variants.append({
                            "name": "Variant",
                            "value": v.get("name") or v.get("sku"),
                            "sku": v.get("sku", ""),
                            "price": v.get("offers", {}).get("price"),
                            "available": True
                        })
            except:
                pass
        return variants

    def extract_shopify_variants(self, html: str) -> List[dict]:
        variants = []
        match = re.search(r'"variants"\s*:\s*(\[\{.*?\}\])', html, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                for v in data:
                    variants.append({
                        "name": "Variant",
                        "value": v.get("title"),
                        "sku": v.get("sku", ""),
                        "price": str(v.get("price") / 100) if v.get("price") else None,
                        "available": v.get("available", True)
                    })
            except:
                pass
        return variants

    def extract_dom_variants(self, html: str) -> List[dict]:
        soup = BeautifulSoup(html, "html.parser")
        variants = []
        seen_texts = set()  # Track what we've already found
        
        for el in soup.find_all(["button", "option", "li"]):
            # Get direct text only (not nested children)
            txt = el.get_text(strip=True)
            
            # Skip if text is too long (likely contains nested content)
            if len(txt) > 40:
                continue
                
            # Skip if doesn't match variant patterns
            if not (1 < len(txt) < 40 and re.search(r'gb|tb|ml|kg|inch|cm|color|size', txt.lower())):
                continue
                
            # Skip if we've already found this variant text
            if txt in seen_texts:
                logger.debug(f"  ⊘ Skipping duplicate DOM variant: {txt}")
                continue
                
            seen_texts.add(txt)
            
            # Try to extract SKU from data attributes
            sku = el.get("data-sku") or el.get("data-variant-id") or ""
            variants.append({
                "name": "Option",
                "value": txt,
                "sku": sku,
                "price": None,
                "available": 'disabled' not in el.get("class", [])
            })
            logger.debug(f"  ✓ Found DOM variant: {txt}")
            
        return variants

    def merge_variants(self, variants: List[dict]) -> List[dict]:
        """Merge and deduplicate variants while preserving order and data."""
        seen, merged = {}, []
        logger.info(f"📊 Merging {len(variants)} total variant entries...")
        
        for v in variants:
            # Use value as key to avoid duplicates
            key = v.get("value")
            if not key:
                logger.debug(f"  ⊘ Skipping variant with no value: {v}")
                continue
            
            # Normalize key for comparison (handle case variations and whitespace)
            norm_key = key.strip().lower()
            # Remove extra whitespace and common text variations
            norm_key = re.sub(r'\s+', ' ', norm_key)  # Normalize whitespace
            
            # If we haven't seen this value, add it
            if norm_key not in seen:
                seen[norm_key] = v
                merged.append(v)
                logger.debug(f"  ✓ Added variant: '{key}' (SKU: {v.get('sku', 'N/A')}, Available: {v.get('available', True)})")
            else:
                # If we have seen it, merge SKU and other data if missing
                existing = seen[norm_key]
                merged_sku = False
                merged_price = False
                
                if not existing.get("sku") and v.get("sku"):
                    existing["sku"] = v.get("sku")
                    merged_sku = True
                    
                if not existing.get("price") and v.get("price"):
                    existing["price"] = v.get("price")
                    merged_price = True
                
                # Update availability - if ANY instance is available, mark as available
                # But if ALL instances show unavailable, mark as unavailable
                if not existing.get("available", True) and v.get("available", True):
                    existing["available"] = True
                elif existing.get("available", True) and not v.get("available", True):
                    # Keep existing=true if it was already true
                    pass
                    
                merge_str = []
                if merged_sku:
                    merge_str.append("SKU")
                if merged_price:
                    merge_str.append("Price")
                    
                merge_info = f" (merged {', '.join(merge_str)})" if merge_str else ""
                logger.debug(f"  ↻ Duplicate variant '{key}' - kept first occurrence{merge_info}")
        
        logger.info(f"✅ Final merged variants: {len(variants)} inputs → {len(merged)} unique items")
        return merged

    # =====================================================
    # IMAGES
    # =====================================================
    # =====================================================
    # IMAGES
    # =====================================================
    def extract_images_brute_force(self, html: str) -> List[str]:
        images = []
        
        # Explicit Flipkart support (upscaling) - Handle protocol relative //
        # PRIORITIZE THIS: Add these FIRST
        # Filter out review/rating images by checking URL patterns and size
        fk_matches = re.findall(r'((?:https?:)?//rukminim\d*\.flixcart\.com/image/[^\s"\'<>]+)', html)
        
        product_images = []
        for m in fk_matches:
            if m.startswith("//"): 
                m = "https:" + m
            
            # EXCLUDE review/rating images (they typically have smaller dimensions or specific paths)
            # Review images often have paths like: /image/128/128/ or /image/50/50/
            # Product images are usually larger: /image/416/416/ or /image/832/832/
            
            # Skip if it's a very small image (likely thumbnail or review image)
            if re.search(r'/image/(50|64|75|100|128)/\1/', m):
                logger.debug(f"  ⊘ Skipping small/review image: {m}")
                continue
            
            # Skip if URL contains review-related keywords
            if any(keyword in m.lower() for keyword in ['review', 'rating', 'customer', 'user-upload']):
                logger.debug(f"  ⊘ Skipping review image: {m}")
                continue
            
            # Upscale to highest quality (832x832 for Flipkart)
            m_large = re.sub(r'/image/\d+/\d+/', '/image/832/832/', m)
            product_images.append(m_large)
            logger.debug(f"  ✓ Found product image: {m_large}")
        
        # Deduplicate and add to main list
        images.extend(list(dict.fromkeys(product_images)))
        
        # Generic Regex for other sites
        # Fix: Use non-capturing group for extension so findall returns the full match
        for m in re.findall(r'(https?://[^"\']+\.(?:jpg|jpeg|png|webp))', html):
            # Skip if already added from Flipkart
            if 'flixcart.com' in m:
                continue
            images.append(m)

        logger.info(f"Extracted {len(images)} product images")
        return list(dict.fromkeys(images))  # Preserve order while removing duplicates

    def normalize_images(self, images: List[str], base_url: str) -> List[str]:
        clean, seen = [], set()
        for img in images:
            if img.startswith("//"):
                img = "https:" + img
            if not img.startswith("http"):
                img = urljoin(base_url, img)
            if img not in seen:
                seen.add(img)
                clean.append(img)
        return clean[:8]

    def download_images(self, image_urls: List[str], output_dir="static/scraped_products") -> Tuple[List[str], Optional[str]]:
        os.makedirs(output_dir, exist_ok=True)
        
        # CRITICAL FIX: Clear old product images before downloading new ones
        # This prevents old images from persisting when scraping a new product
        try:
            import glob
            old_images = glob.glob(os.path.join(output_dir, "product_*.jpg"))
            for old_img in old_images:
                try:
                    os.remove(old_img)
                    logger.debug(f"🗑️ Deleted old image: {old_img}")
                except Exception as e:
                    logger.warning(f"Failed to delete old image {old_img}: {e}")
            if old_images:
                logger.info(f"🧹 Cleared {len(old_images)} old product images")
        except Exception as e:
            logger.warning(f"Failed to clear old images: {e}")
        
        saved, hero, max_area = [], None, 0

        for idx, img_url in enumerate(image_urls):
            if len(saved) >= 5: break
            
            # Browser-like headers to bypass 403
            headers = {
                "User-Agent": self.headers["User-Agent"],
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Referer": "https://www.flipkart.com/" if "flixcart" in img_url else "https://www.google.com/",
                "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Fetch-Dest": "image",
                "Sec-Fetch-Mode": "no-cors",
                "Sec-Fetch-Site": "cross-site"
            }

            content = None
            try:
                # Try 1: With Referer & Headers, No Verify
                r = requests.get(img_url, headers=headers, timeout=10, verify=False)
                if r.status_code == 200:
                    content = r.content
                else:
                    # Try 2: Without Referer
                    headers.pop("Referer", None)
                    r = requests.get(img_url, headers=headers, timeout=10, verify=False)
                    if r.status_code == 200:
                        content = r.content

                if not content: continue

                img = Image.open(BytesIO(content))
                
                # Save
                w, h = img.size
                area = w * h
                
                fname = f"product_{idx}.jpg"
                path = os.path.join(output_dir, fname)

                if img.mode in ("RGBA", "P"): img = img.convert("RGB")
                img.save(path)

                web_path = f"/{output_dir}/{fname}"
                saved.append(web_path)

                if area > max_area:
                    max_area = area
                    hero = web_path

                if len(saved) >= 4:
                    break
            except:
                continue

        return saved, hero

    # =====================================================
    # HELPERS
    # =====================================================
    def extract_json_ld(self, html: str) -> Dict:
        data = {}
        for s in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.DOTALL):
            try:
                js = json.loads(s)
                if js.get("@type") == "Product":
                    data["title"] = js.get("name")
                    data["description"] = js.get("description")
                    data["sku"] = js.get("sku")
                    data["images"] = js.get("image", [])
                    if js.get("offers"):
                        data["price"] = js["offers"].get("price")
            except:
                pass
        return data

    def extract_meta(self, html: str) -> Dict:
        soup = BeautifulSoup(html, "html.parser")
        data = {}
        if soup.title:
            data["title"] = soup.title.get_text()
        og = soup.find("meta", property="og:image")
        if og:
            data["images"] = [og["content"]]
        return data

    def extract_js_state(self, html: str) -> Dict:
        match = re.search(r'__NEXT_DATA__\s*=\s*(\{.*?\})</script>', html, re.DOTALL)
        if match:
            try:
                return self.deep_search(json.loads(match.group(1)))
            except:
                pass
        return {}

    def deep_search(self, obj):
        found = {}
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.lower() in ["price", "sku"]:
                    found[k] = v
                found.update(self.deep_search(v))
        elif isinstance(obj, list):
            for i in obj:
                found.update(self.deep_search(i))
        return found

    def calculate_confidence(self, data: Dict) -> float:
        score = 0
        if data.get("title"): score += 0.25
        if data.get("price"): score += 0.25
        if data.get("sku"): score += 0.2
        if data.get("images"): score += 0.2
        if data.get("variants"): score += 0.1
        return round(score, 2)
