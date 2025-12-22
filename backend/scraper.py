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
            sku = self._extract_sku(soup, url)
            images = self._extract_images(soup, url)
            
            # Determine if it's a store or product page
            is_store = self._is_store_page(soup, url)
            products = self._extract_products(soup) if is_store else []
            
            # Download and filter images
            downloaded_images, hero_image = self._download_images(soup, url)
            
            result = {
                "url": url,
                "title": title,
                "description": description,
                "price": price,
                "sku": sku,
                "images": images,
                "is_store": is_store,
                "products": products,
                "raw_text": soup.get_text()[:2000],
                "downloaded_images": downloaded_images,
                "pageScreenshot": hero_image  # Use the largest image as the "screenshot"
            }
            
            print(f"✅ scrape_url returning: price={price}, sku={sku}, images={len(images)}, downloaded={len(downloaded_images) if downloaded_images else 0}, hero={hero_image}")
            return result
        except Exception as e:
            return {"error": f"Failed to scrape URL: {str(e)}"}
    
    def _extract_sku(self, soup: BeautifulSoup, url: str) -> str:
        """Extract product SKU/Model number"""
        # Try common SKU selectors
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
                if sku_text:
                    print(f"✅ SKU found with selector '{selector}': {sku_text}")
                    return sku_text
        
        # Try meta tags
        meta_sku = soup.select_one('meta[property="product:retailer_item_id"]')
        if meta_sku and meta_sku.get('content'):
            sku = meta_sku.get('content')
            print(f"✅ SKU found in meta tag: {sku}")
            return sku
        
        # Extract from URL (common pattern: /product-name/SKU123)
        import re
        url_sku = re.search(r'/([A-Z0-9]{6,})', url)
        if url_sku:
            sku = url_sku.group(1)
            print(f"✅ SKU extracted from URL: {sku}")
            return sku
        
        print("❌ SKU not found")
        return ""
    
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
        """Extract price with enhanced selectors for major e-commerce platforms"""
        # Extended price selectors for various e-commerce platforms
        price_selectors = [
            # Flipkart - Based on actual HTML inspection
            'div.hZ3P6w.bnqy13',  # Flipkart CURRENT (₹44,990 in screenshot)
            'div.Nx9bqj.CxhGGd',  # Flipkart alternate version
            'div.Nx9bqj',  # Flipkart simplified
            'div.CxhGGd',  # Flipkart variant
            '.hZ3P6w',  # Just the first class
            '.Nx9bqj',  # Just the class
            '._30jeq3',  # Flipkart older version
            '._16Jk6d',  # Flipkart variant
            # Amazon
            '.a-price-whole',
            '.a-price .a-offscreen',
            # Generic selectors
            '.price',
            '.product-price',
            '[itemprop="price"]',
            '.cost',
            '[data-price]',
            '.selling-price',
            '.final-price',
            '.current-price',
            '.price-characteristic'
        ]
        
        for selector in price_selectors:
            element = soup.select_one(selector)
            if element:
                price_text = element.get_text().strip()
                # Clean up price text and validate it contains digits
                if price_text and any(char.isdigit() for char in price_text):
                    print(f"✅ Price found with selector '{selector}': {price_text}")
                    return price_text
        
        # Fallback: Search for meta tags
        meta_price = soup.select_one('meta[property="product:price:amount"]')
        if meta_price and meta_price.get('content'):
            price = meta_price.get('content')
            print(f"✅ Price found in meta tag: {price}")
            return price
        
        # Last resort: Search for text containing currency symbols
        import re
        price_pattern = re.compile(r'[₹$€£¥]\s*[\d,]+(?:\.\d{2})?')
        text_content = soup.get_text()
        matches = price_pattern.findall(text_content)
        if matches:
            # Filter out very small prices (likely not the main product price)
            valid_prices = [m for m in matches if any(c.isdigit() and int(c) > 0 for c in m.replace(',', '').replace('₹', '').replace('$', '').replace('€', '').replace('£', '').replace('¥', ''))]
            if valid_prices:
                price = valid_prices[0].strip()
                print(f"✅ Price found via regex: {price}")
                return price
        
        print("❌ Price not found with any method")
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
        print(f"🔍 _download_images called for URL: {url}")
        
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            print(f"📁 Created output folder: {output_folder}")
            
        img_tags = soup.find_all('img')
        print(f"🖼️  Found {len(img_tags)} img tags in HTML")
        
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
            
            # ✅ COMPREHENSIVE FILTERING: Skip non-product images
            img_url_lower = img_url.lower()
            
            # Skip logos, icons, UI elements, and SUGGESTED/RELATED products
            exclude_patterns = [
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
                # UI sprites
                'sprite', 'thumbnail-sprite', 'ui-', 'icon-',
                # CRITICAL: Suggested/Related products
                'suggest', 'related', 'similar', 'recommended', 'also-bought',
                'customers-also', 'you-may-like', 'trending', 'popular',
                'frequently-bought', 'compare', 'alternative'
            ]
            
            if any(pattern in img_url_lower for pattern in exclude_patterns):
                continue
            
            # Skip SVG files (usually icons/logos)
            if '.svg' in img_url_lower or 'svg' in img_url_lower:
                continue
            
            # Only process common image formats
            if not any(ext in img_url_lower for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                continue

            # Check alt text for non-product indicators
            alt_text = (img.get('alt') or '').lower()
            if any(pattern in alt_text for pattern in exclude_patterns):
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
                    
                    # Skip images smaller than 200x200 (icons, badges, etc.)
                    if width < 200 or height < 200:
                        continue
                        
                    # Calculate area for hero selection
                    area = width * height
                    
                    # Skip extremely wide or tall images (banners, thin strips)
                    aspect_ratio = width / height if height > 0 else 0
                    if aspect_ratio > 4 or aspect_ratio < 0.25:
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
                print(f"Failed to process image {img_url}: {e}")
                continue
                
        # If no hero found but we have images, use the first one
        if not hero_image and saved_images:
            hero_image = saved_images[0]
        
        # Fallback: Try to get OG:image if no images were scraped
        if not hero_image:
            og_image = soup.select_one('meta[property="og:image"]')
            if og_image and og_image.get('content'):
                og_url = og_image.get('content')
                try:
                    # Download OG image as fallback
                    og_response = requests.get(og_url, headers=self.headers, timeout=5)
                    og_response.raise_for_status()
                    
                    filepath = os.path.join(output_folder, f"og_image.jpg")
                    with open(filepath, 'wb') as f:
                        f.write(og_response.content)
                    
                    hero_image = f"/{output_folder.replace(os.sep, '/')}/og_image.jpg"
                    saved_images.append(hero_image)
                    print(f"✅ Using OG:image as fallback: {hero_image}")
                except Exception as e:
                    print(f"Failed to download OG:image: {e}")
        
        print(f"📸 Scraped {len(saved_images)} images, hero: {hero_image}")
        return saved_images, hero_image