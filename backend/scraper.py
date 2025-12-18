from bs4 import BeautifulSoup
import os
import requests
from typing import List, Dict, Optional, Tuple
import json
from urllib.parse import urljoin, urlparse
from PIL import Image
from io import BytesIO

class ProductScraper:
    """Handles web scraping of product and store data"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def scrape_url(self, url: str) -> Dict:
        """Scrape product or store page"""
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            soup    = BeautifulSoup(response.content, 'html.parser')
            
            # Extract basic information
            title = self._extract_title(soup)
            description = self._extract_description(soup)
            price = self._extract_price(soup)
            images = self._extract_images(soup, url)
            
            # Determine if it's a store or product page
            is_store = self._is_store_page(soup, url)
            products = self._extract_products(soup) if is_store else []
            
            # Download and filter images
            downloaded_images, hero_image = self._download_images(soup, url)
            
            return {
                "url": url,
                "title": title,
                "description": description,
                "price": price,
                "images": images,
                "is_store": is_store,
                "products": products,
                "raw_text": soup.get_text()[:2000],
                "downloaded_images": downloaded_images,
                "pageScreenshot": hero_image  # Use the largest image as the "screenshot"
            }
        except Exception as e:
            return {"error": f"Failed to scrape URL: {str(e)}"}
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        title_tags = ['h1', 'title', '[property="og:title"]']
        for tag in title_tags:
            element = soup.select_one(tag)
            if element:
                return element.get_text().strip()
        return "Unknown Product"
    
    def _extract_description(self, soup: BeautifulSoup) -> str:
        desc_selectors = [
            'meta[name="description"]',
            'meta[property="og:description"]',
            '.product-description',
            '#product-description'
        ]
        for selector in desc_selectors:
            element = soup.select_one(selector)
            if element:
                return element.get('content', element.get_text()).strip()
        return ""
    
    def _extract_price(self, soup: BeautifulSoup) -> str:
        price_selectors = ['.price', '.product-price', '[itemprop="price"]', '.cost']
        for selector in price_selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text().strip()
        return "Price not found"
    
    def _extract_images(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        from urllib.parse import urljoin
        images = []
        # Look for images in meta tags first (high quality)
        og_image = soup.select_one('meta[property="og:image"]')
        if og_image and og_image.get('content'):
            images.append(og_image.get('content'))

        # Look for main product images in the body
        img_tags = soup.find_all('img')
        exclude_keywords = ['logo', 'icon', 'banner', 'badge', 'card', 'payment', 'footer', 'header', 'social']
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
            
            # Filter out typical non-product images
            if any(k in src_lower for k in exclude_keywords):
                continue
                
            # Prefer images with product-related keywords or alt text
            alt = (img.get('alt') or '').lower()
            if any(k in src_lower or k in alt for k in product_keywords):
                if src not in images:
                    images.append(src)
        
        # If still no images, just take anything that looks like a product image
        if not images:
            for img in img_tags:
                src = img.get('src')
                if src:
                    src = urljoin(base_url, src)
                    if any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        images.append(src)
                        if len(images) >= 5: break

        return images[:5]
    
    def _is_store_page(self, soup: BeautifulSoup, url: str) -> bool:
        product_indicators = ['.product-item', '.product-card', '[data-product]']
        for indicator in product_indicators:
            if len(soup.select(indicator)) > 1:
                return True
        return 'shop' in url.lower() or 'store' in url.lower()
    
    def _extract_products(self, soup: BeautifulSoup) -> List[Dict]:
        products = []
        product_selectors = ['.product-item', '.product-card', '[data-product]']
        
        for selector in product_selectors:
            items = soup.select(selector)[:10]
            if items:
                for idx, item in enumerate(items):
                    title = item.select_one('h2, h3, .product-title')
                    title_text = title.get_text().strip() if title else f"Product {idx+1}"
                    products.append({
                        "id": idx + 1,
                        "name": title_text
                    })
                break
        return products

    def _download_images(self, soup: BeautifulSoup, url: str, output_folder='static/scraped_products') -> Tuple[List[str], Optional[str]]:
        """Downloads images from the product page and returns (saved_paths, hero_image_path)"""
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            
        img_tags = soup.find_all('img')
        saved_images = []
        hero_image = None
        max_size = 0
        count = 0
        
        for img in img_tags:
            img_url = img.get('src')
            if not img_url:
                continue

            # Handle relative URLs
            img_url = urljoin(url, img_url)
            
            # Skip likely icons/trackers/svgs if possible (though we check size later)
            if any(x in img_url.lower() for x in ['logo', 'icon', 'tracker', 'pixel', 'avatar']):
                continue
            
            if not any(ext in img_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                continue

            try:
                img_response = requests.get(img_url, headers=self.headers, timeout=5)
                img_response.raise_for_status()
                img_data = img_response.content

                try:
                    image = Image.open(BytesIO(img_data))
                    image.verify()
                    image = Image.open(BytesIO(img_data)) # Re-open after verify
                    
                    # ✅ FILTER: Skip small images (icons, stars, logos)
                    width, height = image.size
                    if width < 250 or height < 250:
                        continue
                        
                    # Calculate area for hero selection
                    area = width * height
                    
                    # Skip extremely wide or tall images (banners)
                    aspect_ratio = width / height if height > 0 else 0
                    if aspect_ratio > 3 or aspect_ratio < 0.3:
                        continue
                        
                except Exception as e:
                    continue

                parsed_url = urlparse(img_url)
                filename = os.path.basename(parsed_url.path)
                
                # Sanitize filename
                filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in '._-'])
                if not filename or '.' not in filename:
                     filename = f"image_{count}.jpg"
                else:
                    name, ext = os.path.splitext(filename)
                    if not name: name = f"image_{count}"
                    filename = f"{name}_{count}{ext}"

                filepath = os.path.join(output_folder, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                
                # Return the web-accessible path
                # Assuming static/ is mounted at /static/
                web_path = f"/{output_folder.replace(os.sep, '/')}/{filename}"
                saved_images.append(web_path)
                
                # Check if this is the best hero image so far
                # Favor square-ish or landscape product images
                if area > max_size:
                    max_size = area
                    hero_image = web_path
                
                count += 1
                if count >= 8: # Limit to 8 good images
                    break

            except Exception as e:
                # print(f"Failed to process image {img_url}: {e}")
                continue
                
        # If no hero found but we have images, use the first one
        if not hero_image and saved_images:
            hero_image = saved_images[0]
            
        return saved_images, hero_image