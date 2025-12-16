from bs4 import BeautifulSoup
import os
import requests
from typing import List, Dict, Optional
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
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            soup    = BeautifulSoup(response.content, 'html.parser')
            
            # Extract basic information
            title = self._extract_title(soup)
            description = self._extract_description(soup)
            price = self._extract_price(soup)
            images = self._extract_images(soup)
            
            # Determine if it's a store or product page
            is_store = self._is_store_page(soup, url)
            products = self._extract_products(soup) if is_store else []
            
            return {
                "url": url,
                "title": title,
                "description": description,
                "price": price,
                "images": images,
                "is_store": is_store,
                "products": products,
                "raw_text": soup.get_text()[:2000],
                "downloaded_images": self._download_images(soup, url)
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
    
    def _extract_images(self, soup: BeautifulSoup) -> List[str]:
        images = []
        img_tags = soup.find_all('img', limit=5)
        for img in img_tags:
            src = img.get('src') or img.get('data-src')
            if src and 'product' in src.lower():
                images.append(src)
        return images[:3]
    
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

    def _download_images(self, soup: BeautifulSoup, url: str, output_folder='static/scraped_products') -> List[str]:
        """Downloads images from the product page"""
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            
        img_tags = soup.find_all('img')
        saved_images = []
        count = 0
        
        for img in img_tags:
            img_url = img.get('src')
            if not img_url:
                continue

            img_url = urljoin(url, img_url)
            
            if not any(ext in img_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                continue

            try:
                img_response = requests.get(img_url, headers=self.headers, timeout=10)
                img_response.raise_for_status()
                img_data = img_response.content

                try:
                    image = Image.open(BytesIO(img_data))
                    image.verify()
                    image = Image.open(BytesIO(img_data)) # Re-open after verify
                except:
                    continue

                parsed_url = urlparse(img_url)
                filename = os.path.basename(parsed_url.path)
                if not filename or '.' not in filename:
                     filename = f"image_{count}.jpg"
                else:
                    name, ext = os.path.splitext(filename)
                    filename = f"{name}_{count}{ext}"

                # Ensure filename is safe
                filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in '._-'])
                
                filepath = os.path.join(output_folder, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                
                # Return the web-accessible path
                # Assuming static/ is mounted at /static/
                web_path = f"/{output_folder.replace(os.sep, '/')}/{filename}"
                saved_images.append(web_path)
                count += 1
                
                if count >= 10:
                    break

            except Exception as e:
                print(f"Failed to process image {img_url}: {e}")
                continue
                
        return saved_images