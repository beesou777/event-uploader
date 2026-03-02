import fs from 'fs';
import nlp from 'compromise';
import axios from 'axios';
import { parseISO, format, isValid, parse, addDays, setYear, differenceInDays } from 'date-fns';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

// ==================== MAIN TECH CATEGORIES FOR NORWAY ====================
const MAIN_CATEGORIES = [
  {
    id: 1,
    name: 'Tech & AI',
    keywords: [
      'tech', 'technology', 'ai', 'artificial intelligence', 'machine learning',
      'deep learning', 'llm', 'gpt', 'chatgpt', 'generative ai', 'neural network',
      'computer vision', 'nlp', 'data science', 'big data', 'analytics',
      'cloud', 'aws', 'azure', 'gcp', 'devops', 'kubernetes', 'docker',
      'software', 'programming', 'coding', 'developer', 'frontend', 'backend',
      'fullstack', 'web development', 'mobile app', 'api', 'microservices',
      'blockchain', 'crypto', 'web3', 'cybersecurity', 'security', 'automation',
      'iot', 'robotics', 'quantum computing', 'edge computing'
    ]
  },
  {
    id: 2,
    name: 'Business & Leadership',
    keywords: [
      'business', 'leadership', 'management', 'executive', 'ceo', 'cto', 'cfo',
      'strategy', 'business strategy', 'growth', 'scale', 'scaling',
      'product management', 'product manager', 'agile', 'scrum',
      'transformation', 'digital transformation', 'change management',
      'b2b', 'b2c', 'saas', 'enterprise', 'corporate',
      'finance', 'investment', 'venture capital', 'funding', 'fundraising',
      'marketing', 'sales', 'business development', 'partnerships'
    ]
  },
  {
    id: 3,
    name: 'Career & Learning',
    keywords: [
      'career', 'job', 'employment', 'hiring', 'recruitment', 'talent',
      'learning', 'education', 'training', 'course', 'workshop', 'tutorial',
      'bootcamp', 'certification', 'skill', 'upskill', 'reskill',
      'mentorship', 'coaching', 'personal development', 'professional development',
      'internship', 'graduate', 'junior', 'senior', 'tech career',
      'coding bootcamp', 'tech training', 'learn to code'
    ]
  },
  {
    id: 4,
    name: 'Networking & Community',
    keywords: [
      'networking', 'meetup', 'community', 'social', 'gathering',
      'connect', 'connection', 'network', 'peer', 'collaboration',
      'tech community', 'developer community', 'open source',
      'hackathon', 'hackerspace', 'coworking', 'mixer',
      'coffee chat', 'tech talk', 'lightning talk', 'panel discussion',
      'forum', 'group', 'club', 'association', 'user group'
    ]
  },
  {
    id: 5,
    name: 'Innovation & Future',
    keywords: [
      'innovation', 'future', 'emerging', 'next generation', 'cutting edge',
      'startup', 'entrepreneur', 'entrepreneurship', 'founder',
      'disruptive', 'disruption', 'breakthrough', 'pioneer',
      'research', 'r&d', 'laboratory', 'experiment',
      'future of work', 'future tech', 'trends', 'forecast',
      'sustainability', 'green tech', 'climate tech', 'clean energy',
      'smart city', 'digital innovation', 'tech innovation'
    ]
  }
];

// ==================== AI MODEL CONFIGURATION ====================
const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'huggingface', // 'huggingface' (FREE), 'openai', or 'anthropic'
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY || '', // Optional - free tier works without key
    model: process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.2-3B-Instruct' // Free model
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307'
  },
  // Hugging Face is enabled by default (free tier)
  enabled: !!(process.env.HUGGINGFACE_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.AI_PROVIDER === 'huggingface')
};

// Initialize AI clients
let openaiClient = null;
let anthropicClient = null;
let huggingfaceClient = null;

if (AI_CONFIG.enabled) {
  if (AI_CONFIG.provider === 'huggingface') {
    // Hugging Face works with or without API key (free tier)
    huggingfaceClient = new HfInference(AI_CONFIG.huggingface.apiKey || undefined);
  } else if (AI_CONFIG.provider === 'openai' && AI_CONFIG.openai.apiKey) {
    openaiClient = new OpenAI({ apiKey: AI_CONFIG.openai.apiKey });
  } else if (AI_CONFIG.provider === 'anthropic' && AI_CONFIG.anthropic.apiKey) {
    anthropicClient = new Anthropic({ apiKey: AI_CONFIG.anthropic.apiKey });
  }
}

// ==================== AI-POWERED FEATURE EXTRACTION ====================
async function extractFeaturesWithAI(text, eventName) {
  if (!AI_CONFIG.enabled || !text || text.length < 50) {
    return extractFeaturesWithNLP(text);
  }

  try {
    const prompt = `Extract 3-5 key features/benefits from this tech event description. 
Each feature should be a unique, specific benefit (10-100 characters).
Do NOT repeat the event title. Make features distinct from each other.

Event Title: ${eventName}
Description: ${text.substring(0, 2000)}

Return ONLY a JSON array of feature strings, no other text:
["Feature 1", "Feature 2", "Feature 3"]`;

    let features = [];

    if (huggingfaceClient) {
      // Hugging Face (FREE) - using chat completion for instruction models
      try {
        // Format as chat message for instruction-tuned models
        const chatPrompt = `<|user|>
${prompt}
<|assistant|>
`;
        
        const response = await huggingfaceClient.textGeneration({
          model: AI_CONFIG.huggingface.model,
          inputs: chatPrompt,
          parameters: {
            max_new_tokens: 300,
            temperature: 0.7,
            return_full_text: false,
            stop_sequences: ['<|end|>', '</s>', '\n\n\n']
          }
        });
        
        let content = response.generated_text?.trim() || '';
        
        // Clean up the response
        content = content
          .replace(/<\|assistant\|\>/g, '')
          .replace(/<\|end\|\>/g, '')
          .trim();
        
        // Try to extract JSON array from response
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          try {
            features = JSON.parse(jsonMatch[0]);
          } catch {
            // Try to fix common JSON issues
            const fixed = jsonMatch[0]
              .replace(/'/g, '"')
              .replace(/(\w+):/g, '"$1":');
            try {
              features = JSON.parse(fixed);
            } catch {
              features = extractFeaturesFromText(content);
            }
          }
        } else {
          // Try parsing the whole response
          try {
            features = JSON.parse(content);
          } catch {
            // Extract features from text format
            features = extractFeaturesFromText(content);
          }
        }
      } catch (hfError) {
        console.warn('Hugging Face API error, using NLP fallback:', hfError.message);
        features = extractFeaturesWithNLP(text);
      }
    } else if (openaiClient) {
      const response = await openaiClient.chat.completions.create({
        model: AI_CONFIG.openai.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      });
      const content = response.choices[0]?.message?.content?.trim() || '';
      try {
        features = JSON.parse(content);
      } catch {
        // Fallback to NLP if JSON parse fails
        features = extractFeaturesWithNLP(text);
      }
    } else if (anthropicClient) {
      const response = await anthropicClient.messages.create({
        model: AI_CONFIG.anthropic.model,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      });
      const content = response.content[0]?.text?.trim() || '';
      try {
        features = JSON.parse(content);
      } catch {
        features = extractFeaturesWithNLP(text);
      }
    }

    // Validate and clean features
    return Array.isArray(features)
      ? features
          .filter(f => f && typeof f === 'string' && f.trim() !== '' && f !== eventName)
          .map(f => f.trim())
          .filter(f => f.length > 10 && f.length < 200)
          .slice(0, 5)
      : extractFeaturesWithNLP(text);
  } catch (error) {
    console.warn('AI feature extraction failed, using NLP fallback:', error.message);
    return extractFeaturesWithNLP(text);
  }
}

// Helper to extract features from text format
function extractFeaturesFromText(text) {
  const features = [];
  
  // Try to find list items
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  for (const line of lines) {
    // Match quoted strings
    const quoted = line.match(/"([^"]+)"/);
    if (quoted && quoted[1].length > 10 && quoted[1].length < 200) {
      features.push(quoted[1]);
    }
    // Match list items with dashes or numbers
    else if (line.match(/^[-•\d+\.]\s*(.+)/)) {
      const match = line.match(/^[-•\d+\.]\s*(.+)/);
      if (match && match[1].length > 10 && match[1].length < 200) {
        features.push(match[1].trim());
      }
    }
  }
  
  return features.slice(0, 5);
}

function extractFeaturesWithNLP(text) {
  if (!text || text.length < 50) {
    return [];
  }
  
  const doc = nlp(text);
  const features = [];
  
  // Extract key topics/subjects
  const topics = doc.topics().out('array');
  features.push(...topics.slice(0, 3));
  
  // Extract benefits (sentences with positive indicators)
  const sentences = doc.sentences().out('array');
  const benefits = sentences.filter(s => 
    /\b(learn|gain|discover|explore|build|create|improve|enhance|develop|master|understand)\b/i.test(s)
  );
  features.push(...benefits.slice(0, 2));
  
  // Extract what attendees will get
  const willGet = sentences.filter(s =>
    /\b(will|you'll|you will|attendees|participants)\b/i.test(s)
  );
  features.push(...willGet.slice(0, 2));
  
  // Clean and deduplicate
  return [...new Set(features)]
    .map(f => f.trim())
    .filter(f => f.length > 10 && f.length < 200)
    .slice(0, 5);
}

// ==================== AI-POWERED SOCIAL MEDIA EXTRACTION ====================
function extractSocialMedia(text, url) {
  const socialMedias = {
    facebook: null,
    twitter: null,
    linkedin: null,
    instagram: null
  };
  
  if (!text) return socialMedias;
  
  // Facebook patterns
  const facebookPatterns = [
    /facebook\.com\/([a-zA-Z0-9._-]+)/i,
    /fb\.com\/([a-zA-Z0-9._-]+)/i,
    /fb\.me\/([a-zA-Z0-9._-]+)/i
  ];
  
  // Twitter/X patterns
  const twitterPatterns = [
    /twitter\.com\/([a-zA-Z0-9_]+)/i,
    /x\.com\/([a-zA-Z0-9_]+)/i,
    /@([a-zA-Z0-9_]+)/i
  ];
  
  // LinkedIn patterns
  const linkedinPatterns = [
    /linkedin\.com\/company\/([a-zA-Z0-9-]+)/i,
    /linkedin\.com\/in\/([a-zA-Z0-9-]+)/i
  ];
  
  // Instagram patterns
  const instagramPatterns = [
    /instagram\.com\/([a-zA-Z0-9._]+)/i,
    /instagr\.am\/([a-zA-Z0-9._]+)/i
  ];
  
  const fullText = `${text} ${url || ''}`;
  
  // Extract Facebook
  for (const pattern of facebookPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      socialMedias.facebook = `https://facebook.com/${match[1]}`;
      break;
    }
  }
  
  // Extract Twitter
  for (const pattern of twitterPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      socialMedias.twitter = `https://twitter.com/${match[1]}`;
      break;
    }
  }
  
  // Extract LinkedIn
  for (const pattern of linkedinPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      socialMedias.linkedin = `https://linkedin.com/company/${match[1]}`;
      break;
    }
  }
  
  // Extract Instagram
  for (const pattern of instagramPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      socialMedias.instagram = `https://instagram.com/${match[1]}`;
      break;
    }
  }
  
  return socialMedias;
}

// ==================== SMART CATEGORY MATCHING ====================
function matchCategories(eventText) {
  const text = eventText.toLowerCase();
  const categoryScores = MAIN_CATEGORIES.map(cat => ({
    id: cat.id,
    name: cat.name,
    score: 0
  }));
  
  // Calculate score for each category
  MAIN_CATEGORIES.forEach((cat, index) => {
    cat.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        categoryScores[index].score += matches.length;
      }
    });
  });
  
  // Return categories with score > 0, sorted by score
  return categoryScores
    .filter(cat => cat.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(cat => cat.id)
    .slice(0, 3); // Max 3 categories per event
}

// ==================== FILTER EVENTS BY DATE (TODAY TO 3 MONTHS) ====================
export function filterEventsByDate(events, minDays = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const threeMonthsFromNow = addDays(today, 90);
  
  return events.filter(event => {
    const startDate = parseDate(
      event.startDate || 
      event.start_date || 
      event.dateTime || 
      event.dateText ||
      event.date
    );
    
    if (!startDate) return false;
    
    // Check if it's within [today + minDays, today + 90 days]
    return startDate >= addDays(today, minDays) && startDate <= threeMonthsFromNow;
  });
}

// ==================== PARSE DATE INTELLIGENTLY ====================
function parseDate(dateInput, timeInput = null) {
  if (!dateInput) {
    return null;
  }
  
  try {
    // If already a Date object
    if (dateInput instanceof Date && isValid(dateInput)) {
      return dateInput;
    }
    
    if (typeof dateInput !== 'string') {
      return null;
    }
    
    // Remove timezone abbreviations and extra text
    let cleanDate = dateInput
      .split('+')[0]  // Remove "+ 31 more"
      .trim()
      .replace(/\s+(EST|PST|CST|MST|GMT|UTC|EDT|PDT|CDT|MDT)$/i, '')  // Remove timezone
      .trim();
    
    // Handle "Tuesday at 5:00 PM" format
    if (cleanDate.includes(' at ')) {
      // Extract day of week and time
      const match = cleanDate.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+at\s+(.+)/i);
      if (match) {
        const dayName = match[1];
        const timeStr = match[2];
        
        // Find next occurrence of that day
        const today = new Date();
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const targetDay = daysOfWeek.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
        const currentDay = today.getDay();
        
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7; // Next week if day has passed
        
        const targetDate = addDays(today, daysToAdd);
        
        // Parse time
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const isPM = timeMatch[3].toUpperCase() === 'PM';
          
          if (isPM && hours !== 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
          
          targetDate.setHours(hours, minutes, 0, 0);
          return targetDate;
        }
      }
    }
    
    // Try ISO format
    const iso = parseISO(cleanDate);
    if (isValid(iso) && iso.getFullYear() > 2020) {
      return iso;
    }
    
    // Try direct conversion with current year if missing
    const direct = new Date(cleanDate);
    if (isValid(direct)) {
      // If year is in the past, set to current or next year
      const currentYear = new Date().getFullYear();
      if (direct.getFullYear() < currentYear) {
        direct.setFullYear(currentYear);
      }
      if (direct.getFullYear() >= 2020) {
        return direct;
      }
    }
    
    // Try common formats with date-fns
    const formats = [
      'EEE, MMM d, h:mm a',  // "Mon, Dec 8, 9:00 AM"
      'EEEE, MMM d, h:mm a', // "Monday, Dec 8, 9:00 AM"
      'MMM d, yyyy',         // "Dec 8, 2025"
      'MMM d',               // "Dec 8"
    ];
    
    for (const formatStr of formats) {
      try {
        const referenceDate = new Date();
        const parsed = parse(cleanDate, formatStr, referenceDate);
        if (isValid(parsed)) {
          // If no year in format, ensure it's current or next year
          if (!formatStr.includes('yyyy')) {
            const currentYear = new Date().getFullYear();
            parsed.setFullYear(currentYear);
            // If date is in the past, move to next year
            if (parsed < new Date()) {
              parsed.setFullYear(currentYear + 1);
            }
          }
          return parsed;
        }
      } catch (e) {
        continue;
      }
    }
    
  } catch (err) {
    console.error('Date parsing error for:', dateInput, err.message);
  }
  
  // Return null if all parsing fails
  return null;
}

// ==================== EXTRACT PRICE INFO ====================
function extractTicketInfo(event) {
  const priceText = event.priceText || event.price || '';
  const isFree = /free|gratis|ingen kostnad|kr 0/i.test(priceText);
  
  let price = 0;
  if (!isFree && priceText) {
    // Extract numbers from price text
    const match = priceText.match(/(\d+[.,]?\d*)/);
    if (match) {
      price = parseFloat(match[1].replace(',', '.'));
    }
  }
  
  return {
    name: 'General Admission',
    description: priceText || 'Ticket for the event',
    price: Math.floor(price),
    maximumTicketCapacity: event.capacity || 100,
    currency: 'NOK',
    isFree: isFree,
    hasAvailableTickets: true,
    isSoldOut: /sold out|utsolgt/i.test(priceText)
  };
}

// ==================== HELPER: EXTRACT TITLE FROM URL ====================
function extractTitleFromUrl(url) {
  if (!url) return null;
  try {
    // Eventbrite URLs: /e/event-name-slug-tickets-123456
    const eventbriteMatch = url.match(/\/e\/([^\/\?]+)/);
    if (eventbriteMatch) {
      let slug = eventbriteMatch[1];
      slug = slug.replace(/-tickets-\d+.*$/, '');
      const title = slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return title;
    }
    
    // Meetup URLs: /event-name-slug/
    const meetupMatch = url.match(/\/events\/([^\/\?]+)/);
    if (meetupMatch) {
      const slug = meetupMatch[1];
      const title = slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return title;
    }
  } catch (err) {
    // Silent fail
  }
  return null;
}

// ==================== HELPER: IS GENERIC STATUS ====================
function isGenericStatusMessage(text) {
  if (!text) return true;
  const generic = [
    'sales end soon', 'just added', 'going fast', 'almost full',
    'sold out', 'sales ended', 'privacy policy', 'terms & conditions',
    'code of conduct', 'register now', 'book now', 'buy tickets'
  ];
  const normalized = text.toLowerCase().trim();
  return generic.some(msg => normalized === msg || normalized.startsWith(msg + ' '));
}

// ==================== MAIN CONVERTER ====================
export async function convertToEventSchema(scrapedEvent) {
  // Normalize and clean up the name (remove multiple spaces and newlines)
  let eventName = (scrapedEvent.name || '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Fix title if it's a generic status message
  if (isGenericStatusMessage(eventName)) {
    // Try to extract from URL
    const urlTitle = extractTitleFromUrl(scrapedEvent.url || scrapedEvent.externalRedirectUrl || '');
    if (urlTitle && !isGenericStatusMessage(urlTitle) && urlTitle.length > 5) {
      eventName = urlTitle;
    } else if (scrapedEvent.dateText && !isGenericStatusMessage(scrapedEvent.dateText) && scrapedEvent.dateText.length > 10) {
      // Use dateText if it looks like a title
      if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(scrapedEvent.dateText)) {
        eventName = scrapedEvent.dateText;
      }
    }
  }
  
  // Extract all text for analysis
  const fullText = [
    eventName,
    scrapedEvent.description,
    scrapedEvent.summary,
    scrapedEvent.organizer,
    scrapedEvent.source
  ].filter(Boolean).join(' ');
  
  // Match categories
  const categoryIds = matchCategories(fullText);
  
  // If no categories matched, default to Tech & AI
  if (categoryIds.length === 0) {
    categoryIds.push(1);
  }
  
  // Extract features using AI (with NLP fallback)
  const descriptionText = scrapedEvent.description || scrapedEvent.summary || eventName || '';
  const features = await extractFeaturesWithAI(descriptionText, eventName);
  
  // Extract social media links
  const socialMedias = extractSocialMedia(fullText, scrapedEvent.url);
  
  // Parse dates - try multiple fields
  const startDate = parseDate(
    scrapedEvent.startDate || 
    scrapedEvent.start_date || 
    scrapedEvent.dateTime || 
    scrapedEvent.dateText ||
    scrapedEvent.date
  );
  
  let endDate = parseDate(
    scrapedEvent.endDate || 
    scrapedEvent.end_date ||
    scrapedEvent.dateText ||
    scrapedEvent.date,
    scrapedEvent.end_time
  );
  
  // Ensure endDate is after startDate (default 3 hour event)
  if (endDate <= startDate) {
    endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 3);
  }
  
  // Extract ticket info
  const ticket = extractTicketInfo(scrapedEvent);
  
  // Generate slug
  const slug = (scrapedEvent.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Build final event object
  // Ensure description is never empty and different from title (API requirement)
  let description = scrapedEvent.description || scrapedEvent.summary || '';
  
  // Fix duplicate title/description issue
  if (description.trim().toLowerCase() === eventName.toLowerCase() || 
      description.trim() === '' || 
      description === 'No description') {
    // Generate a unique description that's different from the title
    description = `Join us for ${eventName || 'this event'}. This is a tech event in Norway. Visit the event page for more details and registration information.`;
  }
  
  const finalDescription = description;
  
  const finalEvent = {
    name: eventName || 'Untitled Event',
    slug: slug || `event-${Date.now()}`,
    
    description: finalDescription,
    additionalInfo: scrapedEvent.additionalInfo || '',
    theme: '',
    capacity: scrapedEvent.capacity || 100,
    lang: 'en',
    
    startDate: startDate,
    endDate: endDate,
    
    venue: scrapedEvent.venue || scrapedEvent.location || '',
    city: scrapedEvent.city || scrapedEvent.location || 'Oslo',
    state: scrapedEvent.state || '',
    country: scrapedEvent.country || 'Norway',
    address1: scrapedEvent.address1 || scrapedEvent.address || '',
    address2: scrapedEvent.address2 || '',
    // Always provide coordinates (default to Oslo center if missing - API requires them)
    longitude: scrapedEvent.longitude ? Number(scrapedEvent.longitude) : 10.7522,
    latitude: scrapedEvent.latitude ? Number(scrapedEvent.latitude) : 59.9139,
    
    isPhysical: scrapedEvent.isPhysical !== false && !/(online|virtual|remote)/i.test(fullText),
    platform: scrapedEvent.platform || scrapedEvent.source || '',
    
    socialMedias: socialMedias,
    
    categoryIds: categoryIds,
    images: scrapedEvent.images || (scrapedEvent.image ? [scrapedEvent.image] : []),
    faqs: scrapedEvent.faqs || [],
    audience: scrapedEvent.audience || [],
    // Ensure at least one feature (API requirement)
    features: features.filter(f => f && typeof f === 'string' && f.trim() !== '').length > 0 
      ? features.filter(f => f && typeof f === 'string' && f.trim() !== '')
      : [`Join us for this ${eventName || 'event'}. Check the event page for more details.`],
    
    tickets: [ticket],
    refundPolicy: scrapedEvent.refundPolicy || 'Please visit the event page for refund policy information',
    // CRITICAL: Always ensure externalRedirectUrl is set (required field)
    externalRedirectUrl: scrapedEvent.url || scrapedEvent.externalRedirectUrl || scrapedEvent.link || '',
    
    // Additional fields from the user's Entity
    startTime: format(startDate, 'HH:mm'),
    endTime: format(endDate, 'HH:mm'),
    totalViews: 0,
    isDraft: false,
    isFree: ticket.isFree || false,
    isDeleted: false,
    isCreatedByVerifiedUser: true,
    recievePayment: false,
    creatorId: 2, // Default creator ID as seen in the token/config
    fromPrice: ticket.price || 0,
    ticketCurrency: 'NOK'
  };
  
  // Validate that externalRedirectUrl is present
  if (!finalEvent.externalRedirectUrl || finalEvent.externalRedirectUrl.trim() === '') {
    console.warn(`⚠️  Event "${finalEvent.name}" is missing externalRedirectUrl - this may cause upload issues`);
  }
  
  return finalEvent;
}

// ==================== BATCH CONVERT ====================
export async function convertAllEvents(scrapedEvents) {
  console.log(`\n🔄 Converting ${scrapedEvents.length} events to schema...`);
  if (AI_CONFIG.enabled) {
    const providerName = AI_CONFIG.provider === 'huggingface' ? 'Hugging Face (FREE)' : AI_CONFIG.provider;
    console.log(`🤖 Using AI model: ${providerName} (${AI_CONFIG[AI_CONFIG.provider].model})`);
    if (AI_CONFIG.provider === 'huggingface') {
      console.log(`   💰 FREE - No API costs!`);
    }
  } else {
    console.log(`📝 Using NLP fallback (set AI_PROVIDER=huggingface for FREE AI)`);
  }
  console.log();
  
  const converted = [];
  const errors = [];
  
  // Filter events by date (at least 2-3 days from today)
  const minDaysFromToday = parseInt(process.env.MIN_DAYS_FROM_TODAY) || 0;
  const dateFilteredEvents = filterEventsByDate(scrapedEvents, minDaysFromToday);
  
  if (dateFilteredEvents.length < scrapedEvents.length) {
    console.log(`📅 Filtered out ${scrapedEvents.length - dateFilteredEvents.length} events (must be at least ${minDaysFromToday} days from today)`);
  }
  
  for (let index = 0; index < dateFilteredEvents.length; index++) {
    const event = dateFilteredEvents[index];
    try {
      const converted_event = await convertToEventSchema(event);
      converted.push(converted_event);
      
      console.log(`✅ [${index + 1}/${dateFilteredEvents.length}] ${event.name}`);
      console.log(`   Categories: ${converted_event.categoryIds.map(id => 
        MAIN_CATEGORIES.find(c => c.id === id)?.name
      ).join(', ')}`);
      console.log(`   Features: ${converted_event.features.length} extracted`);
      console.log(`   Social: ${Object.values(converted_event.socialMedias).filter(Boolean).length} links found`);
      console.log(`   Redirect URL: ${converted_event.externalRedirectUrl ? '✅' : '❌ MISSING'}`);
      
      // Small delay to avoid rate limiting with AI APIs
      if (AI_CONFIG.enabled && index < dateFilteredEvents.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ [${index + 1}/${dateFilteredEvents.length}] Error: ${error.message}`);
      errors.push({ event: event.name, error: error.message });
    }
  }
  
  console.log(`\n✅ Successfully converted: ${converted.length}/${dateFilteredEvents.length}`);
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length}`);
  }
  
  return converted;
}

// Run if called directly
const isDirectRun = import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) || 
                   import.meta.url.includes(process.argv[1].replace(/\\/g, '/'));

if (isDirectRun || process.argv[1].includes('ai-converter.js')) {
  const inputFile = process.argv[2] || './scraped-raw.json';
  const outputFile = './output.json';
  
  (async () => {
    try {
      const scrapedEvents = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
      const converted = await convertAllEvents(scrapedEvents);
      
      fs.writeFileSync(outputFile, JSON.stringify(converted, null, 2));
      console.log(`\n💾 Saved ${converted.length} events to ${outputFile}`);
    } catch (error) {
      console.error('Error:', error.message);
    }
  })();
}

export { MAIN_CATEGORIES };

