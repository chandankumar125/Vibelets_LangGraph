# Vibelets - AI-Powered Ad Campaign Generator

## Overview
Vibelets is an intelligent ad campaign creation platform that uses AI to help you create professional video advertisements from product URLs. The platform automates the entire process from product analysis to final video generation.

## Key Features

### 1. Product Analysis
- **URL Scraping**: Simply paste any product URL (e.g., from Shopify, Amazon, or any e-commerce site)
- **AI Analysis**: Automatically analyzes product features, target audience, and unique selling propositions
- **Smart Insights**: Identifies marketing angles and competitive positioning

### 2. Ad Script Generation
- **Multiple Scripts**: Generates 3 unique ad scripts tailored to your product
- **Automated Styles**: AI automatically selects best styles (UGC, Problem/Solution, etc.)
- **Customizable**: Refine scripts with natural language feedback
- **Professional Quality**: Scripts optimized for TikTok, Instagram Reels, and YouTube Shorts

### 3. Creative Generation
- **AI Images**: Generates professional product images based on your script
- **Custom Backgrounds**: Creates aesthetic settings suitable for marketing
- **Multiple Variations**: Get different visual options to choose from
- **Refinement**: Provide feedback to regenerate images with specific changes

### 4. Audio & Voice
- **AI Voiceover**: Automatically generates professional voiceovers from your script
- **Natural Voices**: Uses ElevenLabs for realistic text-to-speech
- **Smart Selection**: AI selects the best voice for your brand

### 5. Avatar Selection
- **HeyGen Integration**: Access to professional AI avatars
- **Diverse Options**: Multiple avatar styles and backgrounds
- **Realistic Presentation**: Avatars deliver your script naturally

### 6. Video Generation
- **Automated Creation**: Combines script, images, audio, and avatar
- **Professional Quality**: Export-ready videos for social media
- **Quick Processing**: Videos generated in minutes

### 7. Facebook Campaign Integration
- **Direct Publishing**: Connect your Facebook account
- **Ad Account Selection**: Choose which ad account to use
- **Campaign Creation**: Automatically create Facebook ad campaigns
- **Media Upload**: Upload generated videos or images directly

## Workflow Steps

1. **Product URL Input**: Start by pasting your product URL
2. **Product Analysis**: AI analyzes your product and identifies key features
3. **Script Generation**: Choose from 3 AI-generated ad scripts
4. **Script Refinement**: Edit and refine your selected script
5. **Image Generation**: Create professional product images
6. **Audio Generation**: Generate voiceover for your script
7. **Avatar Selection**: Choose an AI presenter
8. **Video Generation**: Create your final video ad
9. **Facebook Integration**: Publish directly to Facebook Ads

## Navigation Commands

You can navigate the workflow using natural language:
- "next" or "continue" - Move to the next step
- "go back" - Return to previous step
- "change url" or "new url" - Start over with a different product
- "go to [step name]" - Jump to a specific step
- "refine" or "edit" - Make changes to current output

## Common Questions

### How do I change the product URL?
Type "change url" or "new url" at any time to start over with a different product.

### Can I edit the generated scripts?
Yes! After selecting a script, you can provide feedback like "make it funnier" or "add more urgency" to refine it.

### What if I don't like the generated images?
You can provide specific feedback like "change the background to blue" or "make it more minimalist" to regenerate images.

### How do I connect to Facebook?
Navigate to the Facebook integration step and provide your Facebook access token. The system will automatically fetch your ad accounts.

### Can I use my own images or videos?
Currently, the platform focuses on AI-generated content, but you can select from multiple generated options.

### What video formats are supported?
Videos are generated in standard social media formats optimized for TikTok, Instagram Reels, and YouTube Shorts.

## Troubleshooting

### "Product data not found" error
- Make sure you've entered a valid product URL
- The URL should start with http:// or https://
- Try a different product URL if scraping fails

### "No scripts generated" error
- Ensure product analysis completed successfully
- Try regenerating with different feedback
- Check that your OpenAI API key is configured

### Facebook connection issues
- Verify your Facebook access token is valid
- Ensure you have proper permissions for ad accounts
- Check that your Facebook Business Manager is set up correctly

### Video generation taking too long
- Video generation typically takes 2-5 minutes
- Check the video status endpoint for progress
- Ensure your HeyGen API key is configured correctly

## Support

For additional help or issues not covered here:
- Email: support@vibelets.com
- Check the current step and provide specific details about your issue
- Include any error messages you're seeing

## Tips for Best Results

1. **Choose Clear Product URLs**: Use direct product pages, not category pages
2. **Provide Specific Feedback**: Instead of "make it better", type "add more emphasis on the price"
3. **Review Each Step**: Take time to review analysis and scripts before proceeding
4. **Test Multiple Scripts**: Generate different scripts to find the best approach
5. **Iterate on Visuals**: Don't hesitate to refine images multiple times

## API Integration

Vibelets provides a REST API for programmatic access:
- Base URL: http://localhost:8000
- All endpoints are under `/api/workflow/`
- Requires thread_id for session management
- Supports streaming responses for real-time updates
