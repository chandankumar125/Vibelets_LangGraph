from bs4 import BeautifulSoup
import os
import requests
import httpx
import random
import time
from typing import List, Dict, Optional, Tuple
import json
from urllib.parse import urljoin, urlparse
from PIL import Image
from io import BytesIO

class ProductScraper:
    """Handles web scraping of product and store data"""
    
    def __init__(self):
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
        ]
        self.base_headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        }
    
    def scrape_url(self, url: str) -> Dict:
        """Scrape product or store page"""
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        # Try multiple times with different user agents
        last_error = ""
        for attempt in range(2):
            try:
                headers = self.base_headers.copy()
                headers['User-Agent'] = random.choice(self.user_agents)
                
                # Use httpx for potentially better results
                with httpx.Client(headers=headers, follow_redirects=True, timeout=15.0, http2=False) as client:
                    response = client.get(url)
                    response.raise_for_status()
                    content = response.content
                
                soup = BeautifulSoup(content, 'html.parser')
                
                # Extract structured data first (very reliable for universal scraping)
                json_ld = self._extract_json_ld(soup)
                
                # Extract information using structured data AND meta tags AND selectors
                title = self._extract_title(soup, json_ld)
                description = self._extract_description(soup, json_ld)
                price = self._extract_price(soup, json_ld)
                sku = self._extract_sku(soup, url, json_ld)
                images = self._extract_images(soup, url, json_ld)
                
                # Determine if it's a store or product page
                is_store = self._is_store_page(soup, url, json_ld)
                products = self._extract_products(soup) if is_store else []
                
                # Download and filter images
                downloaded_images, hero_image = self._download_images(soup, url, json_ld)
                
                result = {
                    "url": url,
                    "title": title,
                    "description": description,
                    "price": price,
                    "sku": sku,
                    "images": images,
                    "is_store": is_store,
                    "products": products,
                    "raw_text": soup.get_text()[:4000], # Increased for better analysis
                    "downloaded_images": downloaded_images,
                    "pageScreenshot": hero_image  # Use the largest image as the "screenshot"
                }
                
                print(f"✅ Universal Scrape Success: {title} | Price: {price} | Images: {len(downloaded_images)}")
                return result
            except Exception as e:
                last_error = str(e)
                print(f"⚠️ Scraping attempt {attempt+1} failed: {last_error}")
                if attempt < 1:
                    time.sleep(1) # Wait before retry
                
        return {"error": f"Failed to scrape URL after multiple attempts. Last error: {last_error}"}

    def _extract_json_ld(self, soup: BeautifulSoup) -> Dict:
        """Extract structured data from JSON-LD blocks"""
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                if not script.string: continue
                data = json.loads(script.string)
                
                def find_product(obj):
                    if isinstance(obj, dict):
                        if obj.get('@type') == 'Product' or 'Product' in str(obj.get('@type')):
                            return obj
                        for val in obj.values():
                            res = find_product(val)
                            if res: return res
                    elif isinstance(obj, list):
                        for item in obj:
                            res = find_product(item)
                            if res: return res
                    return None
                
                product = find_product(data)
                if product:
                    print(f"✅ Found product in JSON-LD")
                    return product
            except:
                continue
        return {}

    def _extract_sku(self, soup: BeautifulSoup, url: str, json_ld: Dict = None) -> str:
        """Extract product SKU/Model number"""
        # 1. From JSON-LD
        if json_ld:
            sku = json_ld.get('sku') or json_ld.get('productID') or json_ld.get('mpn')
            if sku: return str(sku)
            
        # 2. Try common SKU selectors
        sku_selectors = [
            '[itemprop="sku"]',
            '[itemprop="productID"]',
            '.sku',
            '.product-sku',
            '[data-sku]',
            '.model-number',
            '.product-id'
        ]
        
        for selector in sku_selectors:
            element = soup.select_one(selector)
            if element:
                sku_text = element.get_text().strip() or element.get('content', '')
                if sku_text: return sku_text
        
        # 3. Try meta tags
        meta_tags = [
            'meta[property="product:retailer_item_id"]',
            'meta[name="sku"]',
            'meta[property="og:upc"]',
            'meta[property="og:isbn"]'
        ]
        for tag in meta_tags:
            el = soup.select_one(tag)
            if el and el.get('content'): return el.get('content')
        
        # 4. Extract from URL
        import re
        url_sku = re.search(r'/([A-Z0-9]{6,})', url)
        if url_sku: return url_sku.group(1)
        
        return ""
    
    def _extract_title(self, soup: BeautifulSoup, json_ld: Dict = None) -> str:
        """Extract product title"""
        # 1. From JSON-LD
        if json_ld and json_ld.get('name'):
            return json_ld.get('name')
            
        # 2. From Meta Tags
        meta_titles = [
            'meta[property="og:title"]',
            'meta[name="twitter:title"]',
            'meta[property="product:name"]'
        ]
        for selector in meta_titles:
            el = soup.select_one(selector)
            if el and el.get('content'): return el.get('content').strip()
            
        # 3. From common H1/Title tags
        title_selectors = ['h1.product-title', 'h1', 'title']
        for selector in title_selectors:
            el = soup.select_one(selector)
            if el:
                text = el.get_text().strip()
                if text and len(text) > 3: return text
                
        return "Unknown Product"
    
    def _extract_description(self, soup: BeautifulSoup, json_ld: Dict = None) -> str:
        """Extract product description"""
        # 1. From JSON-LD
        if json_ld and json_ld.get('description'):
            return json_ld.get('description')
            
        # 2. From Meta Tags
        desc_selectors = [
            'meta[property="og:description"]',
            'meta[name="description"]',
            'meta[name="twitter:description"]'
        ]
        for selector in desc_selectors:
            el = soup.select_one(selector)
            if el and el.get('content'): return el.get('content').strip()
            
        # 3. From common classes
        class_selectors = ['.product-description', '#product-description', '.description', '#description']
        for selector in class_selectors:
            el = soup.select_one(selector)
            if el:
                text = el.get_text().strip()
                if len(text) > 20: return text
                
        return ""
    
    def _extract_price(self, soup: BeautifulSoup, json_ld: Dict = None) -> str:
        """Universal price extraction using Schema.org, Meta tags, and Heuristics"""
        
        # 1. From JSON-LD (Offers)
        if json_ld and 'offers' in json_ld:
            offers = json_ld['offers']
            if isinstance(offers, list): offers = offers[0]
            price = offers.get('price')
            currency = offers.get('priceCurrency') or ""
            if price:
                symbol = "₹" if currency == "INR" else "$" if currency == "USD" else currency
                return f"{symbol}{price}"

        # 2. From Meta Tags (OpenGraph / Product)
        meta_price_tags = [
            ('meta[property="product:price:amount"]', 'meta[property="product:price:currency"]'),
            ('meta[property="og:price:amount"]', 'meta[property="og:price:currency"]'),
            ('meta[name="price"]', None)
        ]
        for amt_tag, cur_tag in meta_price_tags:
            amt_el = soup.select_one(amt_tag)
            if amt_el and amt_el.get('content'):
                price = amt_el.get('content')
                cur_el = soup.select_one(cur_tag) if cur_tag else None
                currency = cur_el.get('content') if cur_el else ""
                symbol = "₹" if "INR" in currency else "$" if "USD" in currency else currency
                return f"{symbol}{price}"

        # 3. Enhanced Selectors (Generic + Common)
        price_selectors = [
            '[itemprop="price"]',
            '.price', '.product-price', '.current-price', '.sales-price',
            # Platform specific (kept as fallback but genericized)
            '[class*="price"]', '[id*="price"]',
            '.a-price-whole', '.a-offscreen', # Amazon
            'div[class*="Nx9bqj"]', # Flipkart modern
        ]
        
        for selector in price_selectors:
            for element in soup.select(selector):
                text = element.get_text().strip()
                # Must contain a digit and ideally a currency symbol
                if text and any(c.isdigit() for c in text):
                    # Clean up: e.g. "Price: $99.00" -> "$99.00"
                    import re
                    match = re.search(r'([₹$€£¥]\s*[\d,]+(?:\.\d{2})?)', text)
                    if match: return match.group(1)
                    # If no symbol, just return the first number part
                    alt_match = re.search(r'([\d,]+(?:\.\d{2})?)', text)
                    if alt_match: return alt_match.group(1)
        
        # 4. Final Fallback: Regex on full text
        import re
        price_pattern = re.compile(r'[₹$€£¥]\s*[\d,]+(?:\.\d{2})?')
        matches = price_pattern.findall(soup.get_text())
        if matches:
            return matches[0].strip()
            
        return "Price not found"
    
    def _extract_images(self, soup: BeautifulSoup, base_url: str, json_ld: Dict = None) -> List[str]:
        from urllib.parse import urljoin
        images = []
        
        # 1. Look for images in JSON-LD first (often high quality)
        if json_ld and json_ld.get('image'):
            img_data = json_ld.get('image')
            if isinstance(img_data, list):
                images.extend([str(i) for i in img_data])
            elif isinstance(img_data, str):
                images.append(img_data)
            elif isinstance(img_data, dict) and img_data.get('url'):
                images.append(img_data.get('url'))

        # 2. Look for images in meta tags
        og_image = soup.select_one('meta[property="og:image"]')
        if og_image and og_image.get('content'):
            img_url = og_image.get('content')
            if img_url not in images: images.append(img_url)

        # Look for main product images in the body
        img_tags = soup.find_all('img')
        
        # COMPREHENSIVE FILTERING - Same as _download_images
        exclude_keywords = [
            'logo', 'icon', 'tracker', 'pixel', 'avatar', 'badge', 'banner',
            'sprite', 'button', 'arrow', 'star', 'rating', 'social', 'payment',
            'footer', 'header', 'nav', 'menu', 'cart', 'search', 'close',
            'play', 'pause', 'share', 'like', 'heart', 'flag', 'tag',
            # E-commerce platform logos
            # 'flipkart', 'amazon', 'ebay', 'walmart', 'shopify',
            # Payment logos
            'visa', 'mastercard', 'paypal', 'stripe', 'gpay', 'paytm',
            # Social media
            'facebook', 'twitter', 'instagram', 'youtube', 'whatsapp',
            # Badge keywords
            'assured', 'certified', 'verified', 'guarantee', 'warranty',
            'bosch', 'samsung', 'lg', 'whirlpool',  # Brand logos
            # UI sprites
            'sprite', 'thumbnail-sprite', 'ui-', 'icon-',
            # CRITICAL: Suggested/Related products
            'suggest', 'related', 'similar', 'recommended', 'also-bought',
            'customers-also', 'you-may-like', 'trending', 'popular',
            'frequently-bought', 'compare', 'alternative', 'you-might',
            # Lifestyle/context images
            'lifestyle', 'context', 'room', 'kitchen', 'bedroom', 'living',
            'interior', 'decor', 'scene', 'ambience', 'setup'
        ]
        
        product_keywords = ['product', 'main', 'primary', 'hero', 'shot', 'image', 'picture']
        
        for img in img_tags:
            # Get the best possible source
            src = img.get('src') or img.get('data-src') or img.get('srcset') or img.get('data-lazy-src')
            if not src:
                continue
            
            # Handle srcset (take the first URL)
            if ',' in src:
                src = src.split(',')[0].strip().split(' ')[0]
            
            # Convert to absolute URL
            src = urljoin(base_url, src)
            src_lower = src.lower()
            
            # Filter out non-product images (comprehensive)
            if any(k in src_lower for k in exclude_keywords):
                continue
            
            # Check alt text for excluded keywords
            alt = (img.get('alt') or '').lower()
            if any(k in alt for k in exclude_keywords):
                continue
            
            # Check parent container classes for suggested/related products
            parent = img.find_parent()
            if parent:
                parent_class = ' '.join(parent.get('class', [])).lower()
                # Check for Flipkart-specific suggested product containers
                if any(k in parent_class for k in [
                    'suggest', 'related', 'similar', 'recommend', 'also', 'you-may', 'trending',
                    'wkl75d',  # Flipkart "You might be interested in"
                    'ikawd',   # Flipkart suggested items container
                    'a_uxlt'   # Flipkart suggested items
                ]):
                    continue
                
                # Also check parent's parent (sometimes nested)
                grandparent = parent.find_parent()
                if grandparent:
                    grandparent_class = ' '.join(grandparent.get('class', [])).lower()
                    if any(k in grandparent_class for k in ['suggest', 'related', 'similar', 'wkl75d', 'ikawd']):
                        continue
                
            # Skip SVG files
            if '.svg' in src_lower or 'svg' in src_lower:
                continue
            
            # Only process common image formats
            if not any(ext in src_lower for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                continue
                
            # Add images that pass all exclusion filters
            # Don't require product keywords - just exclude bad ones
            if src not in images:
                images.append(src)
                # Limit to prevent too many images
                if len(images) >= 10:
                    break
        
        # If still no images, take generic images but still apply filtering
        if not images:
            print("⚠️ No images found with product keywords, trying fallback...")
            for img in img_tags:
                src = img.get('src')
                if src:
                    src = urljoin(base_url, src)
                    src_lower = src.lower()
                    
                    # Still apply exclusion filters
                    if any(k in src_lower for k in exclude_keywords):
                        continue
                    
                    # Check alt text
                    alt = (img.get('alt') or '').lower()
                    if any(k in alt for k in exclude_keywords):
                        continue
                    
                    if any(ext in src_lower for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        images.append(src)
                        if len(images) >= 10: break

        print(f"📸 _extract_images found {len(images)} images")
        return images[:10]
    
    def _is_store_page(self, soup: BeautifulSoup, url: str, json_ld: Dict = None) -> bool:
        # Check JSON-LD type
        if json_ld and (json_ld.get('@type') == 'ItemList' or 'Collection' in str(json_ld.get('@type'))):
            return True
            
        product_indicators = ['.product-item', '.product-card', '[data-product]', '[data-component-type="s-search-result"]', '.s-result-item', '.product-grid']
        for indicator in product_indicators:
            if len(soup.select(indicator)) > 1:
                return True
        return any(k in url.lower() for k in ['shop', 'store', 'category', 'collection', '/s?', 'search'])
    
    def _extract_products(self, soup: BeautifulSoup) -> List[Dict]:
        products = []
        product_selectors = [
            '.product-item', '.product-card', '[data-product]',
            '[data-component-type="s-search-result"]', '.s-result-item'
        ]
        
        for selector in product_selectors:
            items = soup.select(selector)[:10]
            if items:
                for idx, item in enumerate(items):
                    title = item.select_one('h2, h3, .product-title, .a-size-medium, .a-size-base-plus')
                    title_text = title.get_text().strip() if title else f"Product {idx+1}"
                    products.append({
                        "id": idx + 1,
                        "name": title_text
                    })
                break
        return products

    def _download_images(self, soup: BeautifulSoup, url: str, json_ld: Dict = None, output_folder='static/scraped_products') -> Tuple[List[str], Optional[str]]:
        """Downloads images from the product page in parallel and returns (saved_paths, hero_image_path)"""
        print(f"🔍 _download_images called for URL: {url}")
        
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            
        img_tags = soup.find_all('img')
        print(f"🖼️  Found {len(img_tags)} img tags in HTML")
        
        # Prepare valid candidates first
        candidates = []
        exclude_patterns = [
            'logo', 'icon', 'tracker', 'pixel', 'avatar', 'badge', 'banner',
            'sprite', 'button', 'arrow', 'star', 'rating', 'social', 'payment',
            'footer', 'header', 'nav', 'menu', 'cart', 'search', 'close',
            'play', 'pause', 'share', 'like', 'heart', 'flag', 'tag',
            # E-commerce platform logos
            'visa', 'mastercard', 'paypal', 'stripe', 'gpay', 'paytm',
            'facebook', 'twitter', 'instagram', 'youtube', 'whatsapp',
            'assured', 'certified', 'verified', 'guarantee', 'warranty',
            'sprite', 'thumbnail-sprite', 'ui-', 'icon-',
            'suggest', 'related', 'similar', 'recommended', 'also-bought',
            'customers-also', 'you-may-like', 'trending', 'popular',
            'frequently-bought', 'compare', 'alternative'
        ]
        
        seen_urls = set()
        
        for img in img_tags:
            img_url = img.get('src') or img.get('data-src') or img.get('srcset')
            if not img_url: continue
            
            # Simple srcset handling
            if ',' in img_url: img_url = img_url.split(',')[0].strip().split(' ')[0]
            
            img_url = urljoin(url, img_url)
            img_url_lower = img_url.lower()
            
            if img_url in seen_urls: continue
            
            if any(pattern in img_url_lower for pattern in exclude_patterns): continue
            if '.svg' in img_url_lower or 'svg' in img_url_lower: continue
            if not any(ext in img_url_lower for ext in ['.jpg', '.jpeg', '.png', '.webp']): continue
            
            alt_text = (img.get('alt') or '').lower()
            if any(pattern in alt_text for pattern in exclude_patterns): continue
            
            seen_urls.add(img_url)
            candidates.append(img_url)

        # Limit candidates to process (avoid processing 100s of images)
        candidates = candidates[:25] 
        print(f"⚡ Processing {len(candidates)} candidate images in parallel...")

        saved_images = []
        hero_image = None
        max_size = 0
        
        import concurrent.futures
        
        def process_image(img_url):
            try:
                # Lower timeout for faster failure
                img_response = requests.get(img_url, headers={'User-Agent': random.choice(self.user_agents)}, timeout=3.0)
                img_response.raise_for_status()
                img_data = img_response.content
                
                # Check size before PIL to fail fast on small files (approx < 5KB)
                if len(img_data) < 5000:
                    return None

                image = Image.open(BytesIO(img_data))
                width, height = image.size
                
                # Filter small images
                if width < 200 or height < 200: return None
                
                # Filter weird aspect ratios
                aspect_ratio = width / height if height > 0 else 0
                if aspect_ratio > 4 or aspect_ratio < 0.25: return None
                
                parsed_url = urlparse(img_url)
                filename = os.path.basename(parsed_url.path)
                filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in '._-'])
                if not filename or '.' not in filename: filename = f"img_{hash(img_url)}.jpg"
                
                # Add unique suffix to prevent overwrites
                name, ext = os.path.splitext(filename)
                unique_filename = f"{name[:20]}_{int(time.time()*1000)%10000}{ext}"
                filepath = os.path.join(output_folder, unique_filename)
                
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                
                web_path = f"/{output_folder.replace(os.sep, '/')}/{unique_filename}"
                return (web_path, width * height)
            except Exception:
                return None

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(process_image, candidates))
            
        for res in results:
            if res:
                web_path, area = res
                saved_images.append(web_path)
                if area > max_size:
                    max_size = area
                    hero_image = web_path
                if len(saved_images) >= 10: break

        # Fallback to OG Image if no images found
        if not saved_images:
            og_image = soup.select_one('meta[property="og:image"]')
            if og_image and og_image.get('content'):
                try:
                    og_url = og_image.get('content')
                    res = process_image(og_url)
                    if res:
                        web_path, _ = res
                        saved_images.append(web_path)
                        hero_image = web_path
                except:
                    pass
        
        if not hero_image and saved_images:
            hero_image = saved_images[0]
            
        print(f"📸 Parallel scrape finished: {len(saved_images)} images saved")
        return saved_images, hero_image
