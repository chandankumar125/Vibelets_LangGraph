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
import concurrent.futures

# Load environment variables
load_dotenv()


class ImageGenerator:
    def __init__(self):
        self.client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        self.model_id = "imagen-3.0-generate-002"
        self.save_dir = "static/generated_images"
        os.makedirs(self.save_dir, exist_ok=True)

    def scrape_product_images(self, product_url, limit=3):
        """
        Scrapes images from a given product URL and returns a list of PIL Image objects.
        """
        print(f"Scraping images from {product_url}...")
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/91.0.4472.124 Safari/537.36"
            )
        }

        scraped_images = []

        try:
            response = requests.get(product_url, headers=headers, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            img_tags = soup.find_all("img")
            count = 0

            for img in img_tags:
                img_url = img.get("src")
                if not img_url:
                    continue

                img_url = urljoin(product_url, img_url)

                if not any(ext in img_url.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                    continue

                try:
                    img_data = requests.get(img_url, headers=headers, timeout=10).content
                    image = Image.open(BytesIO(img_data))
                    image.verify()
                    image = Image.open(BytesIO(img_data))
                    scraped_images.append(image)
                    count += 1

                    if count >= limit:
                        break

                except Exception:
                    continue

            print(f"Scraped {len(scraped_images)} images.")
            return scraped_images

        except Exception as e:
            print(f"Error scraping URL: {e}")
            return []

    def generate_ad_creatives(self, product_url, script_content, num_alterations=2):
        """
        Generates ad creatives based on product URL + script content.
        """
        images = self.scrape_product_images(product_url, limit=1)

        if not images:
            print("No product images found to use as reference.")
            return []

        original_image = images[0]

        prompt = (
            "Create a professional commercial advertisement static featuring this product. "
            f"Context from ad script: '{script_content[:200]}...'. "
            "Place the product in a high-quality, aesthetic setting suitable for a marketing campaign. "
            "Ensure the product remains the focal point. "
            "Style: Modern, Premium, Commercial Photography."
        )

        generated_urls = []

        def generate_single_image(p, img):
            try:
                resp = self.client.models.generate_content(
                    model="gemini-2.0-flash-exp",
                    contents=[p, img],
                    config=types.GenerateContentConfig(candidate_count=1),
                )

                if resp.parts:
                    for part in resp.parts:
                        if part.inline_data:
                            gen_img = part.as_image()
                            fname = f"ad_creative_{uuid.uuid4()}.png"
                            fpath = os.path.join(self.save_dir, fname)
                            gen_img.save(fpath)
                            return f"/{fpath.replace(os.sep, '/')}"
            except Exception as e:
                print(f"Error in parallel image gen: {e}")

            return None

        try:
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=num_alterations
            ) as executor:
                futures = [
                    executor.submit(generate_single_image, prompt, original_image)
                    for _ in range(num_alterations)
                ]

                for future in concurrent.futures.as_completed(futures):
                    res = future.result()
                    if res:
                        generated_urls.append(res)

            return generated_urls

        except Exception as e:
            print(f"Error generating alterations: {e}")
            return []

    def generate_ad_creatives_with_prompt(self, product_url, custom_prompt, num_alterations=2, base_image=None):
        """
        Generates ad creatives using a custom prompt.
        """
        if base_image:
            original_image = base_image
        else:
            images = self.scrape_product_images(product_url, limit=1)
            if not images:
                print("No product images found to use as reference.")
                return []
            original_image = images[0]
            
        generated_urls = []

        def generate_single_custom(p, img):
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                print("ERROR: GOOGLE_API_KEY not found in environment")
                return None

            try:
                # 1. If we have an image, get a description first to maintain product consistency
                refined_prompt = p
                if img:
                    try:
                        describe_resp = self.client.models.generate_content(
                            model="gemini-2.0-flash-exp",
                            contents=["Describe the key visual product features in this image that must be preserved in a new ad creative. Focus on shape, color, and unique design elements.", img],
                        )
                        if describe_resp and describe_resp.text:
                            refined_prompt = f"Product Details: {describe_resp.text}\n\nAd Creative Request: {p}\n\nStyle: High-end commerce photography, professional lighting, 8k resolution."
                            print(f"DEBUG: Refined prompt created using Gemini vision")
                    except Exception as e:
                        print(f"WARNING: Gemini vision description failed, using original prompt: {e}")

                # 2. Use Nano Banana Pro (Gemini variant) as requested
                print(f"DEBUG: Calling Nano Banana Pro with model models/nano-banana-pro-preview...")
                try:
                    resp = self.client.models.generate_content(
                        model="imagen-3.0-generate-002",
                        contents=[refined_prompt],
                        config=types.GenerateContentConfig(
                            response_modalities=["image"],
                            candidate_count=1
                        )
                    )

                    if resp.parts:
                        for part in resp.parts:
                            # Handle executable code if present
                            if part.executable_code:
                                continue
                                
                            # Check for inline data (image)
                            if part.inline_data:
                                gen_img = part.as_image()
                                
                                fname = f"ad_creative_{uuid.uuid4()}.png"
                                fpath = os.path.join(self.save_dir, fname)
                                
                                # Ensure save_dir exists
                                os.makedirs(self.save_dir, exist_ok=True)
                                
                                gen_img.save(fpath)
                                print(f"✅ Image generated successfully: {fpath}")
                                return f"/{fpath.replace(os.sep, '/')}"
                    
                    print(f"❌ Nano Banana Response Issue: No image parts returned. Response: {resp}")

                except Exception as e:
                    print(f"❌ Error in Nano Banana Pro generation: {e}")
            except Exception as e:
                print(f"❌ Error in image generation wrapper: {type(e).__name__}: {e}")
            return None

        try:
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=num_alterations
            ) as executor:
                futures = [
                    executor.submit(generate_single_custom, custom_prompt, original_image)
                    for _ in range(num_alterations)
                ]

                for future in concurrent.futures.as_completed(futures):
                    res = future.result()
                    if res:
                        generated_urls.append(res)

            return generated_urls

        except Exception as e:
            print(f"Error generating images with custom prompt: {e}")
            return []
