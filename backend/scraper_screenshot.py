import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from PIL import Image
from io import BytesIO

def scrape_product_images(url, output_folder='static'):
    """
    Scrapes a product URL for images and saves them to a static folder.

    Args:
        url (str): The URL of the product page to scrape.
        output_folder (str): The directory to save the downloaded images.
    """
    # Create the output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"Created directory: {output_folder}")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    try:
        print(f"Fetching URL: {url}")
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        img_tags = soup.find_all('img')
        
        print(f"Found {len(img_tags)} image tags.")

        count = 0
        for img in img_tags:
            img_url = img.get('src')
            if not img_url:
                continue

            # Handle relative URLs
            img_url = urljoin(url, img_url)
            
            # Basic filter to avoid tracking pixels and small icons
            # You might want to refine this based on the specific site's structure
            if not any(ext in img_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                continue

            try:
                # Get the image content
                img_response = requests.get(img_url, headers=headers, timeout=10)
                img_response.raise_for_status()
                img_data = img_response.content

                # Verify it's a valid image using PIL
                image = Image.open(BytesIO(img_data))
                image.verify()
                
                # Reset file pointer after verify
                image = Image.open(BytesIO(img_data))

                # Generate a filename
                # Using a simple counter for now, but could use hash or original name
                parsed_url = urlparse(img_url)
                filename = os.path.basename(parsed_url.path)
                if not filename or '.' not in filename:
                     filename = f"image_{count}.jpg"
                else:
                    # Ensure unique filenames if multiple images have same name
                    name, ext = os.path.splitext(filename)
                    filename = f"{name}_{count}{ext}"

                filepath = os.path.join(output_folder, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                
                print(f"Saved: {filepath}")
                count += 1
                
                # Optional: Limit the number of images to download
                if count >= 10:
                    print("Reached limit of 10 images.")
                    break

            except Exception as e:
                print(f"Failed to process image {img_url}: {e}")
                continue

        print(f"Scraping complete. Saved {count} images to '{output_folder}'.")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching the URL: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    # Example usage
    product_url = input("Enter the product URL: ")
    scrape_product_images(product_url)
