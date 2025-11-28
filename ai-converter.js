import fs from 'fs';
import nlp from 'compromise';
import axios from 'axios';
import { parseISO, format, isValid, parse, addDays, setYear } from 'date-fns';

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

// ==================== AI-POWERED FEATURE EXTRACTION ====================
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

// ==================== PARSE DATE INTELLIGENTLY ====================
function parseDate(dateInput, timeInput = null) {
  if (!dateInput) {
    // Default to 7 days from now if no date provided
    return addDays(new Date(), 7);
  }
  
  try {
    // If already a Date object
    if (dateInput instanceof Date && isValid(dateInput)) {
      return dateInput;
    }
    
    if (typeof dateInput !== 'string') {
      return addDays(new Date(), 7);
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
  
  // Default to 7 days from now if all parsing fails
  return addDays(new Date(), 7);
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

// ==================== MAIN CONVERTER ====================
export function convertToEventSchema(scrapedEvent) {
  // Extract all text for analysis
  const fullText = [
    scrapedEvent.name,
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
  
  // Extract features using NLP
  const features = extractFeaturesWithNLP(
    scrapedEvent.description || scrapedEvent.summary || scrapedEvent.name
  );
  
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
  // Ensure description is never empty (API requirement)
  const description = scrapedEvent.description || scrapedEvent.summary || scrapedEvent.name || '';
  const finalDescription = description.trim() === '' || description === 'No description' 
    ? `Join us for ${scrapedEvent.name || 'this event'}. Visit the event page for more details.`
    : description;
  
  return {
    name: scrapedEvent.name || 'Untitled Event',
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
      : [`Join us for this ${scrapedEvent.name || 'event'}. Check the event page for more details.`],
    
    tickets: [ticket],
    refundPolicy: scrapedEvent.refundPolicy || 'Please visit the event page for refund policy information',
    externalRedirectUrl: scrapedEvent.url || scrapedEvent.externalRedirectUrl || '',
  };
}

// ==================== BATCH CONVERT ====================
export function convertAllEvents(scrapedEvents) {
  console.log(`\n🔄 Converting ${scrapedEvents.length} events to schema...\n`);
  
  const converted = [];
  const errors = [];
  
  scrapedEvents.forEach((event, index) => {
    try {
      const converted_event = convertToEventSchema(event);
      converted.push(converted_event);
      
      console.log(`✅ [${index + 1}/${scrapedEvents.length}] ${event.name}`);
      console.log(`   Categories: ${converted_event.categoryIds.map(id => 
        MAIN_CATEGORIES.find(c => c.id === id)?.name
      ).join(', ')}`);
      console.log(`   Features: ${converted_event.features.length} extracted`);
      console.log(`   Social: ${Object.values(converted_event.socialMedias).filter(Boolean).length} links found`);
    } catch (error) {
      console.error(`❌ [${index + 1}/${scrapedEvents.length}] Error: ${error.message}`);
      errors.push({ event: event.name, error: error.message });
    }
  });
  
  console.log(`\n✅ Successfully converted: ${converted.length}/${scrapedEvents.length}`);
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length}`);
  }
  
  return converted;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputFile = process.argv[2] || './scraped-unique.json';
  const outputFile = './output.json';
  
  try {
    const scrapedEvents = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    const converted = convertAllEvents(scrapedEvents);
    
    fs.writeFileSync(outputFile, JSON.stringify(converted, null, 2));
    console.log(`\n💾 Saved ${converted.length} events to ${outputFile}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

export { MAIN_CATEGORIES };

