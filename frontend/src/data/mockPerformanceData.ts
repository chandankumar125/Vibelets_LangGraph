import { UnifiedMetrics, PublishedCampaign, AIRecommendation, PerformanceDashboardState } from '@/types/campaign';

export const mockUnifiedMetrics: UnifiedMetrics = {
  totalSpent: {
    id: 'total-spent',
    label: 'Total Spent',
    value: 2847.50,
    previousValue: 2234.00,
    format: 'currency',
    trend: 'up'
  },
  profit: {
    id: 'profit',
    label: 'Profit',
    value: 8542.30,
    previousValue: 7123.00,
    format: 'currency',
    trend: 'up'
  },
  roi: {
    id: 'roi',
    label: 'ROI',
    value: 300,
    previousValue: 280,
    format: 'percentage',
    trend: 'up'
  },
  conversions: {
    id: 'conversions',
    label: 'Conversions',
    value: 127,
    previousValue: 98,
    format: 'number',
    trend: 'up'
  },
  aov: {
    id: 'aov',
    label: 'Avg Order Value',
    value: 89.50,
    previousValue: 84.20,
    format: 'currency',
    trend: 'up'
  },
  ctr: {
    id: 'ctr',
    label: 'Click Rate',
    value: 3.2,
    previousValue: 2.8,
    format: 'percentage',
    trend: 'up'
  }
};

export const mockPublishedCampaigns: PublishedCampaign[] = [
  {
    id: 'camp-1',
    name: 'Premium Earbuds - Sales',
    status: 'active',
    budget: '$50/day',
    lifecycleStage: 'optimizing',
    stageProgress: 65,
    stageDescription: 'AI is fine-tuning your audience targeting based on early conversion data',
    metrics: [
      { id: 'spent-1', label: 'Spent', value: 1423.75, previousValue: 1100, format: 'currency', trend: 'up' },
      { id: 'profit-1', label: 'Profit', value: 4271.15, previousValue: 3500, format: 'currency', trend: 'up' },
      { id: 'roi-1', label: 'ROI', value: 300, previousValue: 280, format: 'percentage', trend: 'up' },
      { id: 'conversions-1', label: 'Conversions', value: 64, previousValue: 52, format: 'number', trend: 'up' }
    ],
    changes: [
      { id: 'ch-1', category: 'good', title: 'Click rate improved', description: 'More people are clicking your ad - up 12% from last week', metric: 'CTR', change: '+12.4%' },
      { id: 'ch-2', category: 'good', title: 'Cost per sale dropped', description: 'You\'re spending less to get each customer now', metric: 'CPA', change: '-8.2%' },
      { id: 'ch-3', category: 'steady', title: 'Budget on track', description: 'Your daily spending is consistent with your target' }
    ],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'camp-2',
    name: 'Earbuds Pro - Awareness',
    status: 'learning',
    budget: '$30/day',
    lifecycleStage: 'testing',
    stageProgress: 25,
    stageDescription: 'AI is learning which audiences respond best to your ads',
    metrics: [
      { id: 'spent-2', label: 'Spent', value: 423.75, previousValue: 0, format: 'currency', trend: 'up' },
      { id: 'profit-2', label: 'Profit', value: 971.15, previousValue: 0, format: 'currency', trend: 'up' },
      { id: 'roi-2', label: 'ROI', value: 229, previousValue: 0, format: 'percentage', trend: 'neutral' },
      { id: 'conversions-2', label: 'Conversions', value: 18, previousValue: 0, format: 'number', trend: 'up' }
    ],
    changes: [
      { id: 'ch-4', category: 'attention', title: 'Still in learning phase', description: 'Give Facebook a few more days to optimize your audience' },
      { id: 'ch-5', category: 'good', title: 'Strong initial engagement', description: 'People are responding well to your creative' }
    ],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'camp-3',
    name: 'Holiday Special',
    status: 'paused',
    budget: '$75/day',
    lifecycleStage: 'scaling',
    stageProgress: 90,
    stageDescription: 'Campaign reached scaling phase before being paused',
    metrics: [
      { id: 'spent-3', label: 'Spent', value: 1000, previousValue: 1134, format: 'currency', trend: 'down' },
      { id: 'profit-3', label: 'Profit', value: 3300, previousValue: 3623, format: 'currency', trend: 'down' },
      { id: 'roi-3', label: 'ROI', value: 330, previousValue: 320, format: 'percentage', trend: 'up' },
      { id: 'conversions-3', label: 'Conversions', value: 45, previousValue: 46, format: 'number', trend: 'down' }
    ],
    changes: [
      { id: 'ch-6', category: 'action-taken', title: 'Campaign paused', description: 'You paused this campaign 2 days ago' },
      { id: 'ch-7', category: 'good', title: 'Strong ROI maintained', description: 'Performance was excellent before pausing' }
    ],
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  }
];

export const mockRecommendations: AIRecommendation[] = [
  {
    id: 'rec-1',
    type: 'budget-increase',
    priority: 'high',
    campaignId: 'camp-1',
    campaignName: 'Premium Earbuds - Sales',
    title: 'Increase budget to capture more sales',
    reasoning: 'This campaign is performing exceptionally well with a 300% ROI. Increasing the budget could help you reach more potential customers while maintaining profitability.',
    currentValue: 50,
    recommendedValue: 75,
    projectedImpact: [
      { label: 'Additional Daily Sales', value: '+8-12' },
      { label: 'Expected ROI', value: '280-320%' },
      { label: 'Reach Increase', value: '+50%' }
    ],
    createdAt: new Date()
  },
  {
    id: 'rec-2',
    type: 'pause-creative',
    priority: 'high',
    campaignId: 'camp-1',
    campaignName: 'Premium Earbuds - Sales',
    title: 'Pause underperforming video ad',
    reasoning: 'The "Quick Demo" video has 40% lower engagement than your other creatives. Pausing it will redirect budget to better performing ads.',
    creative: {
      id: 'creative-3',
      name: 'Quick Demo Video',
      thumbnail: 'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=400',
      metrics: [
        { label: 'CTR', value: '1.2%' },
        { label: 'CPA', value: '$28.50' },
        { label: 'ROAS', value: '2.1x' }
      ]
    },
    projectedImpact: [
      { label: 'Budget Saved', value: '$15/day' },
      { label: 'Avg CTR Improvement', value: '+0.4%' }
    ],
    createdAt: new Date(Date.now() - 60 * 60 * 1000)
  },
  {
    id: 'rec-3',
    type: 'resume-campaign',
    priority: 'medium',
    campaignId: 'camp-3',
    campaignName: 'Holiday Special',
    title: 'Resume your paused campaign',
    reasoning: 'Market conditions are favorable and your Holiday Special campaign had excellent performance. Consider resuming to capitalize on current demand.',
    currentValue: 0,
    recommendedValue: 75,
    projectedImpact: [
      { label: 'Estimated Daily Sales', value: '12-18' },
      { label: 'Expected ROI', value: '310-340%' }
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: 'rec-4',
    type: 'clone-creative',
    priority: 'suggestion',
    campaignId: 'camp-1',
    campaignName: 'Premium Earbuds - Sales',
    title: 'Use winning creative in other campaigns',
    reasoning: 'Your "Lifestyle Feature" video is outperforming all other creatives with 4.2% CTR. Consider using it in your awareness campaign.',
    creative: {
      id: 'creative-2',
      name: 'Lifestyle Feature Video',
      thumbnail: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=400',
      metrics: [
        { label: 'CTR', value: '4.2%' },
        { label: 'CPA', value: '$18.20' },
        { label: 'ROAS', value: '4.8x' }
      ]
    },
    targetCampaigns: [
      { id: 'camp-2', name: 'Earbuds Pro - Awareness', recommended: true },
      { id: 'camp-3', name: 'Holiday Special' }
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
  },
  {
    id: 'rec-5',
    type: 'budget-decrease',
    priority: 'suggestion',
    campaignId: 'camp-2',
    campaignName: 'Earbuds Pro - Awareness',
    title: 'Consider reducing budget during learning',
    reasoning: 'This campaign is still in learning phase. A slightly lower budget can reduce risk while Facebook optimizes your targeting.',
    currentValue: 30,
    recommendedValue: 20,
    projectedImpact: [
      { label: 'Daily Savings', value: '$10' },
      { label: 'Learning Period', value: 'Same' }
    ],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
  }
];

export const createMockPerformanceDashboard = (): PerformanceDashboardState => ({
  unifiedMetrics: mockUnifiedMetrics,
  publishedCampaigns: mockPublishedCampaigns,
  recommendations: mockRecommendations,
  selectedCampaignId: null,
  isActionCenterOpen: false
});
