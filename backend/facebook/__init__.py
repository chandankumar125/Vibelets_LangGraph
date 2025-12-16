"""
Facebook integration package
Contains modules for authentication, campaign creation, ad sets, ads, and media management

Note: Requires facebook-business SDK to be installed
Install with: pip install facebook-business
"""

# Import key functions for easier access (only if facebook-business is installed)
try:
    from .auth import authenticate_user
    from .campaigns import create_campaign
    from .adsets import create_adset
    from .ads import create_video_ad, create_image_ad
    from .media import upload_image, upload_video
    
    __all__ = [
        'authenticate_user',
        'create_campaign',
        'create_adset',
        'create_video_ad',
        'create_image_ad',
        'upload_image',
        'upload_video'
    ]
except ImportError:
    # Facebook SDK not installed, provide placeholder functions
    __all__ = []
    
    def authenticate_user(*args, **kwargs):
        raise ImportError("facebook-business SDK not installed. Run: pip install facebook-business")
    
    def create_campaign(*args, **kwargs):
        raise ImportError("facebook-business SDK not installed. Run: pip install facebook-business")
    
    def create_adset(*args, **kwargs):
        raise ImportError("facebook-business SDK not installed. Run: pip install facebook-business")
    
    def create_video_ad(*args, **kwargs):
        raise ImportError("facebook-business SDK not installed. Run: pip install facebook-business")
    
    def create_image_ad(*args, **kwargs):
        raise ImportError("facebook-business SDK not installed. Run: pip install facebook-business")
    
    def upload_image(*args, **kwargs):
        raise ImportError("facebook-business SDK not installed. Run: pip install facebook-business")
    
    def upload_video(*args, **kwargs):
        raise ImportError("facebook-business SDK not installed. Run: pip install facebook-business")
