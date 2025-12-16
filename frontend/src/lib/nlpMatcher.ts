import { InlineQuestion } from '@/types/campaign';

interface MatchResult {
  matched: boolean;
  optionId: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Attempts to match user input to an option in the active question using natural language.
 * Supports patterns like:
 * - Direct label match: "Script A", "Problem-Solution"
 * - Ordinal reference: "the first one", "option 2", "second"
 * - Partial keyword match: "storytelling", "professional"
 * - Affirmative for binary: "yes", "continue", "go ahead"
 */
export const matchUserInputToOption = (
  input: string,
  activeQuestion: InlineQuestion | null
): MatchResult => {
  if (!activeQuestion || !input.trim()) {
    return { matched: false, optionId: null, confidence: 'low' };
  }

  const normalizedInput = input.toLowerCase().trim();
  const options = activeQuestion.options;

  // 1. Exact label match (high confidence)
  for (const option of options) {
    if (option.label.toLowerCase() === normalizedInput) {
      return { matched: true, optionId: option.id, confidence: 'high' };
    }
  }

  // 2. ID match (high confidence) - e.g., "script-a"
  for (const option of options) {
    if (option.id.toLowerCase() === normalizedInput.replace(/\s+/g, '-')) {
      return { matched: true, optionId: option.id, confidence: 'high' };
    }
  }

  // 3. Ordinal references (high confidence)
  const ordinalPatterns: { pattern: RegExp; index: number }[] = [
    { pattern: /^(the\s+)?(first|1st|one|option\s*1|#1|number\s*1)(\s+one)?$/i, index: 0 },
    { pattern: /^(the\s+)?(second|2nd|two|option\s*2|#2|number\s*2)(\s+one)?$/i, index: 1 },
    { pattern: /^(the\s+)?(third|3rd|three|option\s*3|#3|number\s*3)(\s+one)?$/i, index: 2 },
    { pattern: /^(the\s+)?(fourth|4th|four|option\s*4|#4|number\s*4)(\s+one)?$/i, index: 3 },
    { pattern: /^(the\s+)?(fifth|5th|five|option\s*5|#5|number\s*5)(\s+one)?$/i, index: 4 },
    { pattern: /^(the\s+)?(sixth|6th|six|option\s*6|#6|number\s*6)(\s+one)?$/i, index: 5 },
    { pattern: /^(the\s+)?(seventh|7th|seven|option\s*7|#7|number\s*7)(\s+one)?$/i, index: 6 },
    { pattern: /^(the\s+)?(eighth|8th|eight|option\s*8|#8|number\s*8)(\s+one)?$/i, index: 7 },
  ];

  for (const { pattern, index } of ordinalPatterns) {
    if (pattern.test(normalizedInput) && options[index]) {
      return { matched: true, optionId: options[index].id, confidence: 'high' };
    }
  }

  // 4. Letter references for scripts/avatars (high confidence) - "A", "B", "Script B"
  const letterMatch = normalizedInput.match(/^(?:script\s*|avatar\s*|option\s*|creative\s*)?([a-h])$/i);
  if (letterMatch) {
    const letterIndex = letterMatch[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    if (options[letterIndex]) {
      return { matched: true, optionId: options[letterIndex].id, confidence: 'high' };
    }
  }

  // 5. Affirmative patterns for binary choices (high confidence)
  if (activeQuestion.id === 'product-continue') {
    const continuePatterns = /^(yes|yep|yeah|sure|ok|okay|continue|proceed|go|go ahead|let'?s go|next|looks good|perfect|great)$/i;
    const changePatterns = /^(no|nope|change|different|other|new|wrong|another)$/i;
    
    if (continuePatterns.test(normalizedInput)) {
      const continueOption = options.find(o => o.id === 'continue');
      if (continueOption) return { matched: true, optionId: continueOption.id, confidence: 'high' };
    }
    if (changePatterns.test(normalizedInput)) {
      const changeOption = options.find(o => o.id === 'change');
      if (changeOption) return { matched: true, optionId: changeOption.id, confidence: 'high' };
    }
  }

  // 6. Publish confirmation patterns
  if (activeQuestion.id === 'publish-confirm') {
    const publishPatterns = /^(publish|launch|go live|submit|send|do it|let'?s go|yes|start)$/i;
    const reviewPatterns = /^(review|preview|check|wait|hold|details|see|look)$/i;
    
    if (publishPatterns.test(normalizedInput)) {
      const publishOption = options.find(o => o.id === 'publish');
      if (publishOption) return { matched: true, optionId: publishOption.id, confidence: 'high' };
    }
    if (reviewPatterns.test(normalizedInput)) {
      const reviewOption = options.find(o => o.id === 'preview');
      if (reviewOption) return { matched: true, optionId: reviewOption.id, confidence: 'high' };
    }
  }

  // 7. Custom option patterns (high confidence)
  const customPatterns = /^(custom|my own|write|upload|create|make my own|i'?ll write|own)$/i;
  if (customPatterns.test(normalizedInput)) {
    const customOption = options.find(o => o.id.includes('custom'));
    if (customOption) return { matched: true, optionId: customOption.id, confidence: 'high' };
  }

  // 8. Partial label match - significant word overlap (medium confidence)
  for (const option of options) {
    const labelWords = option.label.toLowerCase().split(/\s+/);
    const inputWords = normalizedInput.split(/\s+/);
    
    // Check if input contains a significant portion of the label
    const matchingWords = labelWords.filter(word => 
      word.length > 2 && inputWords.some(iw => iw.includes(word) || word.includes(iw))
    );
    
    if (matchingWords.length >= 1 && matchingWords.length >= labelWords.length * 0.5) {
      return { matched: true, optionId: option.id, confidence: 'medium' };
    }
  }

  // 9. Description keyword match (medium confidence)
  for (const option of options) {
    if (option.description) {
      const descWords = option.description.toLowerCase().split(/\s+/);
      const inputWords = normalizedInput.split(/\s+/);
      
      const matchingWords = descWords.filter(word => 
        word.length > 3 && inputWords.some(iw => iw === word)
      );
      
      if (matchingWords.length >= 2) {
        return { matched: true, optionId: option.id, confidence: 'medium' };
      }
    }
  }

  // 10. Fuzzy single word match against option labels (low confidence)
  for (const option of options) {
    const labelWords = option.label.toLowerCase().split(/[\s-]+/);
    if (labelWords.some(word => word.length > 3 && normalizedInput.includes(word))) {
      return { matched: true, optionId: option.id, confidence: 'low' };
    }
  }

  return { matched: false, optionId: null, confidence: 'low' };
};

/**
 * Checks if the input looks like a product URL (to avoid matching URLs as selections)
 */
export const looksLikeUrl = (input: string): boolean => {
  return /^https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.shop|\.store/i.test(input.trim());
};
