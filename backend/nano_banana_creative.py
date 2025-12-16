from google import genai 
from google.genai import types
# import google.generative as genai

# import google.genai as genai
# from google import types
from PIL import Image
import requests
from bs4 import BeautifulSoup
import os
from urllib.parse import urljoin
from io import BytesIO
from dotenv import load_dotenv


# Load environment variables
load_dotenv()

# Initialize the GenAI client (referred to as "Nano Banana" in user context)
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

def scrape_product_images(product_url, save_dir="scraped_products"):
    """
    Scrapes images from a given product URL and saves them locally.
    """
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    
    print(f"Scraping images from {product_url}...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    
    try:
        response = requests.get(product_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all image tags
        img_tags = soup.find_all('img')
        
        saved_images = []
        count = 0
        
        for img in img_tags:
            img_url = img.get('src')
            if not img_url:
                continue
                
            # Handle relative URLs
            img_url = urljoin(product_url, img_url)
            
            # Simple filter for product-like images (ignoring small icons/tracking pixels)
            # This is a basic heuristic; in production, use size checking or more advanced filtering
            if not any(ext in img_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                continue

            try:
                img_data = requests.get(img_url, headers=headers, timeout=10).content
                
                # Verify it's a valid image
                try:
                    Image.open(BytesIO(img_data)).verify()
                except Exception:
                    continue
                
                filename = f"product_{count}.jpg"
                filepath = os.path.join(save_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                
                saved_images.append(filepath)
                count += 1
                
                # Limit to 3 images for PoC
                if count >= 3:
                    break
                    
            except Exception as e:
                print(f"Failed to download {img_url}: {e}")
                
        print(f"Scraped {len(saved_images)} images.")
        return saved_images
        
    except Exception as e:
        print(f"Error scraping URL: {e}")
        return []

def create_ad_alterations(image_path, num_alterations=2):
    """
    Uses the GenAI model to create commercial ad alterations of the product image.
    """
    print(f"Generating {num_alterations} alterations for {image_path}...")
    
    try:
        original_image = Image.open(image_path)
        
        # Prompt for commercial ad generation
        prompt = (
            "Create a professional commercial advertisement static featuring this product. "
            "Place the product in a high-quality, aesthetic setting suitable for a marketing campaign. "
            "Ensure the product remains the focal point. "
            "Style: Modern, Premium, Commercial Photography."
        )
        
        # Generate content
        # Note: Using the model ID from the original file
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt, original_image],
            config=types.GenerateContentConfig(
                candidate_count=1 # Generate one at a time for control, or increase if supported
            )
        )
        
        generated_files = []
        
        # Handle response
        if response.parts:
            for i, part in enumerate(response.parts):
                # Check for inline data (image)
                if part.inline_data:
                    generated_image = part.as_image()
                    output_filename = f"{os.path.splitext(image_path)[0]}_ad_{i+1}.png"
                    generated_image.save(output_filename)
                    generated_files.append(output_filename)
                    print(f"Saved alteration: {output_filename}")
                elif part.text:
                    print(f"Model returned text: {part.text}")
                    
        # If the model supports generating multiple candidates in one go, we might need to adjust loop
        # For this PoC, we'll just run the loop if we need distinct variations and the API returns 1
        
        return generated_files

    except Exception as e:
        print(f"Error generating alterations: {e}")
        return []

def main(product_url):
    # 1. Scrape Images
    scraped_images = scrape_product_images(product_url)
    
    if not scraped_images:
        print("No images found to process.")
        return

    # 2. Generate Alterations for the first scraped image (best candidate usually)
    # Using "Nano Banana" (GenAI) to create alterations
    best_image = scraped_images[0]
    create_ad_alterations(best_image, num_alterations=3)

target_url = "https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111" 
main(target_url)