from google import genai
from google.genai import types
from PIL import Image
import requests
from bs4 import BeautifulSoup
import os
from urllib.parse import urljoin
from io import BytesIO
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

class ImageGenerator:
    def __init__(self):
        self.client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        self.save_dir = "static/generated_images"
        if not os.path.exists(self.save_dir):
            os.makedirs(self.save_dir)

    def scrape_product_images(self, product_url, limit=3):
        """
        Scrapes images from a given product URL and returns a list of PIL Image objects.
        """
        print(f"Scraping images from {product_url}...")
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        
        scraped_images = []
        
        try:
            response = requests.get(product_url, headers=headers, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all image tags
            img_tags = soup.find_all('img')
            
            count = 0
            
            for img in img_tags:
                img_url = img.get('src')
                if not img_url:
                    continue
                    
                # Handle relative URLs
                img_url = urljoin(product_url, img_url)
                
                # Simple filter for product-like images
                if not any(ext in img_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                    continue

                try:
                    img_data = requests.get(img_url, headers=headers, timeout=10).content
                    
                    # Verify it's a valid image
                    try:
                        image = Image.open(BytesIO(img_data))
                        image.verify()
                        # Re-open because verify() closes the file
                        image = Image.open(BytesIO(img_data))
                        scraped_images.append(image)
                        count += 1
                    except Exception:
                        continue
                    
                    if count >= limit:
                        break
                        
                except Exception as e:
                    print(f"Failed to download {img_url}: {e}")
                    
            print(f"Scraped {len(scraped_images)} images.")
            return scraped_images
            
        except Exception as e:
            print(f"Error scraping URL: {e}")
            return []

    def generate_ad_creatives(self, product_url, script_content, num_alterations=2):
        """
        Generates ad creatives based on the product URL and script content.
        Returns a list of URLs to the generated images.
        """
        # 1. Scrape images (we need at least one reference image)
        images = self.scrape_product_images(product_url, limit=1)
        
        if not images:
            print("No product images found to use as reference.")
            return []
            
        original_image = images[0]
        
        # 2. Generate alterations
        print(f"Generating {num_alterations} alterations...")
        
        prompt = (
            f"Create a professional commercial advertisement static featuring this product. "
            f"Context from ad script: '{script_content[:200]}...'. "
            "Place the product in a high-quality, aesthetic setting suitable for a marketing campaign. "
            "Ensure the product remains the focal point. "
            "Style: Modern, Premium, Commercial Photography."
        )
        
        generated_urls = []
        
        try:
            # Generate content
            response = self.client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=[prompt, original_image],
                config=types.GenerateContentConfig(
                    candidate_count=1 
                )
            )
            
            if response.parts:
                for i, part in enumerate(response.parts):
                    if part.inline_data:
                        generated_image = part.as_image()
                        
                        # Save to static directory
                        filename = f"ad_creative_{uuid.uuid4()}.png"
                        filepath = os.path.join(self.save_dir, filename)
                        generated_image.save(filepath)
                        
                        # URL relative to server root (assuming static is mounted at /static)
                        # Note: server.py mounts "static" dir to "/static" path
                        # filepath is "static/generated_images/..."
                        # url should be "/static/generated_images/..."
                        
                        # Windows path separator fix
                        web_path = filepath.replace(os.sep, '/')
                        generated_urls.append(f"/{web_path}")
                        print(f"Saved alteration: {filepath}")
                        
            # If we need more than 1 and the model only returns 1 per call, loop
            # For now, let's just do one call as per the original script logic which seemed to imply one call or loop.
            # The original script had a loop over response.parts, but candidate_count=1.
            # If we want multiple, we might need multiple calls if candidate_count > 1 isn't supported or reliable.
            
            if len(generated_urls) < num_alterations:
                 # Simple loop for remaining
                 for _ in range(num_alterations - len(generated_urls)):
                    response = self.client.models.generate_content(
                        model="gemini-2.5-flash-image",
                        contents=[prompt, original_image],
                        config=types.GenerateContentConfig(candidate_count=1)
                    )
                    if response.parts:
                        for part in response.parts:
                            if part.inline_data:
                                generated_image = part.as_image()
                                filename = f"ad_creative_{uuid.uuid4()}.png"
                                filepath = os.path.join(self.save_dir, filename)
                                generated_image.save(filepath)
                                web_path = filepath.replace(os.sep, '/')
                                generated_urls.append(f"/{web_path}")

            return generated_urls

        except Exception as e:
            print(f"Error generating alterations: {e}")
            return []
    
    def generate_ad_creatives_with_prompt(self, product_url, custom_prompt, num_alterations=2):
        """
        Generates ad creatives using a custom prompt (from agent).
        Returns a list of URLs to the generated images.
        """
        # 1. Scrape images (we need at least one reference image)
        images = self.scrape_product_images(product_url, limit=1)
        
        if not images:
            print("No product images found to use as reference.")
            return []
            
        original_image = images[0]
        
        # 2. Generate using custom prompt
        print(f"Generating {num_alterations} images with custom prompt...")
        
        generated_urls = []
        
        try:
            # Generate content with custom prompt
            for _ in range(num_alterations):
                response = self.client.models.generate_content(
                    model="gemini-2.5-flash-image",
                    contents=[custom_prompt, original_image],
                    config=types.GenerateContentConfig(candidate_count=1)
                )
                
                if response.parts:
                    for part in response.parts:
                        if part.inline_data:
                            generated_image = part.as_image()
                            
                            # Save to static directory
                            filename = f"ad_creative_{uuid.uuid4()}.png"
                            filepath = os.path.join(self.save_dir, filename)
                            generated_image.save(filepath)
                            
                            web_path = filepath.replace(os.sep, '/')
                            generated_urls.append(f"/{web_path}")
                            print(f"Saved image: {filepath}")

            return generated_urls

        except Exception as e:
            print(f"Error generating images with custom prompt: {e}")
            return []