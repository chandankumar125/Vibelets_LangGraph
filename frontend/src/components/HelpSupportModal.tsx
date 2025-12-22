/**
 * Help & Support Modal Component
 * Automatically pops up when user queries trigger support responses
 */

import React from 'react';

interface SuggestedAction {
    label: string;
    step?: string;  // Navigate to this workflow step
    action?: string; // Perform this action
}

interface HelpSupportModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
    confidence: number;
    suggestedActions: SuggestedAction[];
    onNavigateToStep: (step: string) => void;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({
    isOpen,
    onClose,
    message,
    confidence,
    suggestedActions,
    onNavigateToStep
}) => {
    if (!isOpen) return null;

    const handleActionClick = (action: SuggestedAction) => {
        if (action.step) {
            // Navigate to the specified workflow step
            onNavigateToStep(action.step);
            onClose();
        } else if (action.action) {
            // Handle custom actions
            if (action.action.startsWith('mailto:')) {
                window.location.href = action.action;
            } else if (action.action === 'show_features') {
                // Show features documentation
                console.log('Show features');
            } else if (action.action === 'show_facebook_guide') {
                // Show Facebook guide
                console.log('Show Facebook guide');
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-700">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Help & Support</h2>
                            <p className="text-sm text-gray-400">Vibelets AI Assistant</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* AI Response */}
                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-200 whitespace-pre-line leading-relaxed">
                                    {message}
                                </p>
                                {confidence && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                                                style={{ width: `${confidence * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {Math.round(confidence * 100)}% confident
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Suggested Actions */}
                    {suggestedActions && suggestedActions.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                                Quick Actions
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {suggestedActions.map((action, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleActionClick(action)}
                                        className="group flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-all duration-200"
                                    >
                                        <span className="text-white font-medium">{action.label}</span>
                                        <svg
                                            className="w-5 h-5 text-gray-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pt-4 border-t border-gray-700">
                        <p className="text-sm text-gray-400 text-center">
                            Still need help?{' '}
                            <a
                                href="mailto:support@vibelets.com"
                                className="text-blue-400 hover:text-blue-300 underline"
                            >
                                Contact Support
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Usage Example in your main component:
/*
const [supportModal, setSupportModal] = useState({
  isOpen: false,
  message: '',
  confidence: 0,
  suggestedActions: []
});

// When you receive a chat response:
const handleChatResponse = (response) => {
  if (response.is_support_response) {
    // Open help & support modal
    setSupportModal({
      isOpen: true,
      message: response.message,
      confidence: response.support_confidence,
      suggestedActions: response.suggested_actions || []
    });
  } else {
    // Handle normal navigation
    handleNavigation(response.navigation_intent);
  }
};

// In your JSX:
<HelpSupportModal
  isOpen={supportModal.isOpen}
  onClose={() => setSupportModal({ ...supportModal, isOpen: false })}
  message={supportModal.message}
  confidence={supportModal.confidence}
  suggestedActions={supportModal.suggestedActions}
  onNavigateToStep={(step) => {
    // Navigate to the specified step
    navigateToStep(step);
  }}
/>
*/
