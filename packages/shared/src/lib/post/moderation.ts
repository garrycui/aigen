import { checkContentMeaning, moderateContentWithAPI } from '../../lib/common/openai';

// Forbidden keywords and patterns
const FORBIDDEN_PATTERNS = {
  spam: [
    'buy now',
    'click here',
    'limited time',
    'act now',
    'best price',
    'discount',
    'free offer',
    'guaranteed',
    'order now',
    'special promotion'
  ],
  offensive: [
    'hate',
    'racist',
    'stupid',
    'idiot',
    'dumb',
    'moron'
  ],
  unsafe: [
    'password',
    'credit card',
    'social security',
    'bank account',
    'routing number'
  ]
};

export interface ModerationResult {
  allowed: boolean;
  category?: string;
  reason?: string;
  suggestions?: string[];
}

/**
 * Check content for spam patterns
 */
const checkSpamPatterns = (content: string): boolean => {
  const lowerContent = content.toLowerCase();
  const spamCount = FORBIDDEN_PATTERNS.spam.filter(pattern => 
    lowerContent.includes(pattern)
  ).length;
  return spamCount > 2;
};

/**
 * Check content for offensive language
 */
const checkOffensivePatterns = (content: string): boolean => {
  const lowerContent = content.toLowerCase();
  return FORBIDDEN_PATTERNS.offensive.some(pattern => 
    lowerContent.includes(pattern)
  );
};

/**
 * Check content for unsafe patterns (PII, sensitive data)
 */
const checkUnsafePatterns = (content: string): boolean => {
  const lowerContent = content.toLowerCase();
  return FORBIDDEN_PATTERNS.unsafe.some(pattern => 
    lowerContent.includes(pattern)
  );
};

/**
 * Get improvement suggestions based on content issues
 */
const getSuggestions = (content: string, type: 'title' | 'content'): string[] => {
  const suggestions: string[] = [];

  // Title-specific checks
  if (type === 'title') {
    if (content.length < 10) {
      suggestions.push('Title should be at least 10 characters long.');
    }
    if (content.length > 100) {
      suggestions.push('Consider making your title more concise (under 100 characters).');
    }
    if (!/^[A-Z]/.test(content)) {
      suggestions.push('Start your title with a capital letter.');
    }
    if (/[.!?]$/.test(content)) {
      suggestions.push('Avoid ending your title with punctuation marks.');
    }
    if (content.toUpperCase() === content) {
      suggestions.push('Avoid using all capital letters in your title.');
    }
  }
  // Content-specific checks
  else {
    if (content.length < 100) {
      suggestions.push('Content should be at least 100 characters long to provide value.');
    }
    if (content.length > 10000) {
      suggestions.push('Consider breaking very long content into multiple posts.');
    }
    if (content.split('\n\n').length === 1 && content.length > 200) {
      suggestions.push('Break up long text into paragraphs for better readability.');
    }
    if ((content.match(/!!/g) || []).length > 2) {
      suggestions.push('Use exclamation marks sparingly.');
    }
  }

  // Common checks
  if (!content.includes(' ')) {
    suggestions.push('Add spaces between words for better readability.');
  }
  if (/(.)\1{4,}/.test(content)) {
    suggestions.push('Avoid repeating characters unnecessarily.');
  }
  if ((content.match(/\b\w{20,}\b/g) || []).length > 0) {
    suggestions.push('Break up very long words for better readability.');
  }

  return suggestions;
};

/**
 * Check if content meets minimum quality standards
 */
const checkQuality = (content: string, type: 'title' | 'content'): boolean => {
  // Title-specific quality checks
  if (type === 'title') {
    if (content.length < 10) {
      return false;
    }
    if (!/[a-zA-Z]/.test(content)) {
      return false;
    }
    if (/^[^a-zA-Z0-9]*$/.test(content)) {
      return false;
    }
  }
  // Content-specific quality checks
  else {
    if (content.length < 100) {
      return false;
    }
    if (content.trim().split(/\s+/).length < 20) {
      return false;
    }
  }

  // Common quality checks
  if (/^(.)\1+$/.test(content.replace(/\s/g, ''))) {
    return false;
  }
  if (!/[a-zA-Z]/.test(content)) {
    return false;
  }

  return true;
};

/**
 * Main moderation function that checks content using multiple methods
 */
export const moderateContent = async (content: string, type: 'title' | 'content' = 'content'): Promise<ModerationResult> => {
  try {
    // Basic quality check
    if (!checkQuality(content, type)) {
      return {
        allowed: false,
        category: 'quality',
        reason: type === 'title' 
          ? 'Title does not meet minimum quality standards (at least 10 characters, meaningful text)'
          : 'Content does not meet minimum quality standards (at least 100 characters, meaningful text)',
        suggestions: getSuggestions(content, type)
      };
    }

    // Check for spam patterns
    if (checkSpamPatterns(content)) {
      return {
        allowed: false,
        category: 'spam',
        reason: 'Content appears to be promotional or spam',
        suggestions: [
          'Remove promotional language',
          'Focus on providing value to the community',
          'Avoid sales-focused content'
        ]
      };
    }

    // Check for offensive content
    if (checkOffensivePatterns(content)) {
      return {
        allowed: false,
        category: 'offensive',
        reason: 'Content contains inappropriate language',
        suggestions: [
          'Remove offensive language',
          'Express your thoughts respectfully',
          'Focus on constructive discussion'
        ]
      };
    }

    // Check for unsafe content
    if (checkUnsafePatterns(content)) {
      return {
        allowed: false,
        category: 'unsafe',
        reason: 'Content may contain sensitive information',
        suggestions: [
          'Remove any personal or sensitive information',
          'Never share private data publicly',
          'Focus on general discussion topics'
        ]
      };
    }

    // Check content meaning using imported function
    const meaningCheck = await checkContentMeaning(content, type);
    if (!meaningCheck.isAppropriate) {
      return {
        allowed: false,
        category: 'inappropriate',
        reason: meaningCheck.reason || 'Content is not appropriate for this forum',
        suggestions: meaningCheck.suggestions || [
          'Ensure content is relevant to AI and technology learning',
          'Maintain a professional and constructive tone',
          'Focus on sharing valuable experiences or questions'
        ]
      };
    }

    // Use OpenAI's moderation API for final check via imported function
    const moderationResult = await moderateContentWithAPI(content);
    if (moderationResult.flagged) {
      return {
        allowed: false,
        category: moderationResult.category || 'inappropriate',
        reason: 'Content flagged by AI moderation',
        suggestions: [
          'Review and revise your content',
          'Ensure it follows community guidelines',
          'Remove any inappropriate content'
        ]
      };
    }

    // Content passed all checks
    const suggestions = getSuggestions(content, type);
    return {
      allowed: true,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };

  } catch (error) {
    console.error('Moderation error:', error);
    return {
      allowed: false,
      category: 'error',
      reason: 'Unable to verify content safety',
      suggestions: [
        'Try submitting again',
        'If the problem persists, contact support'
      ]
    };
  }
};