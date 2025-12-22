/**
 * API Client for Vibelets Backend
 * Connects frontend to LangGraph workflow
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export interface WorkflowState {
  current_step: string;
  navigation_intent?: string;
  messages: Array<{ role: string; content: string }>;
  url?: string;
  product_data?: any;
  selected_product?: any;
  analysis?: any;
  analysis_feedback?: string[];
  scripts?: any[];
  script_feedback?: string[];
  selected_script_index?: number;
  selected_script?: any;
  script_refinement_feedback?: string[];
  generated_images?: any[];
  image_feedback?: string[];
  image_generation_prompt?: string;
  audio_file?: string;
  audio_url?: string;
  available_avatars?: any[];
  selected_avatar_id?: string;
  video_id?: string;
  video_url?: string;
  video_status?: string;
  error?: string;
  iteration_count?: Record<string, number>;
  // Facebook related
  facebook_access_token?: string;
  facebook_user_id?: string;
  ad_accounts?: any[];
  selected_ad_account_id?: string;
  selected_media?: any;
  campaign_config?: any;
  campaign_preview?: string;
  publish_status?: string;
}

export interface ApiResponse<T = any> {
  thread_id: string;
  state: WorkflowState;
  current_step?: string;
  error?: string;
  [key: string]: any;
}

class VibeletsAPI {
  private threadId: string | null = localStorage.getItem('vibelets_thread_id');

  /**
   * Get or create a thread ID for the session
   */
  private getThreadId(): string {
    if (!this.threadId) {
      this.threadId = crypto.randomUUID();
      localStorage.setItem('vibelets_thread_id', this.threadId);
    }
    return this.threadId;
  }

  /**
   * Reset the session
   */
  resetSession(): void {
    this.threadId = null;
    localStorage.removeItem('vibelets_thread_id');
  }

  /**
   * Scrape product URL
   */
  async scrapeProduct(url: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        url
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to scrape product: ${response.statusText}`);
    }

    const data = await response.json();
    this.threadId = data.thread_id;
    if (this.threadId) {
      localStorage.setItem('vibelets_thread_id', this.threadId);
    }
    return data;
  }

  /**
   * Analyze product
   */
  async analyzeProduct(feedback?: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        feedback
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to analyze product: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate scripts
   */
  async generateScripts(feedback?: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/generate_scripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        feedback
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate scripts: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Select a script
   */
  async selectScript(scriptIndex: number): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/select_script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        script_index: scriptIndex
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to select script: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Refine selected script
   */
  async refineScript(feedback: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/refine_script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        feedback
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to refine script: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate images
   */
  async generateImages(feedback?: string, numImages: number = 2): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/generate_images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        feedback,
        num_images: numImages
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate images: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Refine images
   */
  async refineImages(feedback: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/refine_images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        feedback
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to refine images: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate audio
   */
  async generateAudio(): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/generate_audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate audio: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get available avatars
   */
  async getAvatars(): Promise<{ thread_id: string; avatars: any[] }> {
    const response = await fetch(`${API_BASE_URL}/workflow/avatars?thread_id=${this.getThreadId()}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Failed to get avatars: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Select avatar
   */
  async selectAvatar(avatarId: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/select_avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        avatar_id: avatarId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to select avatar: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate video
   */
  async generateVideo(): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/generate_video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate video: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Check status of video generation
   */
  async getVideoStatus(videoId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/workflow/video_status/${videoId}`);
    if (!response.ok) {
      throw new Error(`Failed to check video status: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Navigate to a specific step
   */
  async navigate(navigationIntent: string, message?: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        navigation_intent: navigationIntent,
        message
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to navigate: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Send a chat message
   */
  async chat(message: string, navigationIntent?: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        message,
        navigation_intent: navigationIntent
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send chat message: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get current workflow state
   */
  async getState(): Promise<{ thread_id: string; state: WorkflowState }> {
    const threadId = this.getThreadId();
    const response = await fetch(`${API_BASE_URL}/workflow/state/${threadId}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Failed to get state: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Stream workflow events (for real-time updates)
   */
  async* streamWorkflow(message?: string): AsyncGenerator<any, void, unknown> {
    const threadId = this.getThreadId();
    const url = `${API_BASE_URL}/workflow/stream?thread_id=${threadId}${message ? `&message=${encodeURIComponent(message)}` : ''}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to stream workflow: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            yield data;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Facebook Campaign Methods
   */

  /**
   * Authenticate with Facebook
   */
  async authenticateFacebook(accessToken: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/facebook_auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        access_token: accessToken
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate with Facebook: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Select Facebook Ad Account
   */
  async selectAdAccount(adAccountId: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/select_ad_account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        ad_account_id: adAccountId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to select ad account: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Select media for Facebook ad
   */
  async selectMedia(mediaType: 'image' | 'video', mediaUrl: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/select_media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        media_type: mediaType,
        media_url: mediaUrl
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to select media: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate campaign preview
   */
  async previewCampaign(): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/preview_campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate campaign preview: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Refine campaign configuration
   */
  async refineCampaign(feedback: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/refine_campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId(),
        feedback
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to refine campaign: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Publish campaign to Facebook
   */
  async publishCampaign(): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/workflow/publish_campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: this.getThreadId()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to publish campaign: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get current state from backend (for persistence/refresh)
   */
  async getCurrentState(): Promise<ApiResponse> {
    const threadId = this.getThreadId();
    const response = await fetch(`${API_BASE_URL}/workflow/state/${threadId}`);

    if (!response.ok) {
      // If no state found, return empty state
      if (response.status === 404) {
        return {
          thread_id: threadId,
          state: {
            current_step: 'scrape',
            messages: []
          }
        };
      }
      throw new Error(`Failed to get current state: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generic POST request
   */
  async post(endpoint: string, body: any): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `http://localhost:8000${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }

    return await response.json();
  }

}

// Export a singleton instance
export const vibeletsAPI = new VibeletsAPI();

export default vibeletsAPI;
