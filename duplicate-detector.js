import stringSimilarity from 'string-similarity';
import { parseISO, differenceInDays, isValid } from 'date-fns';
import fs from 'fs';

// ==================== CONFIGURATION ====================
const SIMILARITY_THRESHOLD = 0.85; // 85% similarity = likely duplicate
const DATE_THRESHOLD_DAYS = 1; // Events within 1 day considered same
const URL_MATCH_WEIGHT = 1.0; // If URLs match exactly, it's definitely a duplicate

// ==================== NORMALIZE TEXT ====================
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ==================== EXTRACT DATE FROM VARIOUS FORMATS ====================
function extractDate(event) {
  // Try different date fields
  const dateFields = [
    event.startDate,
    event.start_date,
    event.dateTime,
    event.dateText,
    event.date
  ];
  
  for (const field of dateFields) {
    if (!field) continue;
    
    try {
      // If it's already a Date object
      if (field instanceof Date && isValid(field)) {
        return field;
      }
      
      // Try parsing ISO format
      const parsed = parseISO(field);
      if (isValid(parsed)) {
        return parsed;
      }
      
      // Try creating Date directly
      const direct = new Date(field);
      if (isValid(direct)) {
        return direct;
      }
    } catch (err) {
      continue;
    }
  }
  
  return null;
}

// ==================== NORMALIZE URL ====================
function normalizeUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    // Remove query params and fragments for comparison
    return `${urlObj.origin}${urlObj.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().trim();
  }
}

// ==================== CALCULATE SIMILARITY SCORE ====================
function calculateSimilarity(event1, event2) {
  const scores = {
    name: 0,
    date: 0,
    location: 0,
    url: 0,
    overall: 0
  };
  
  // 1. NAME SIMILARITY (Most important - 50% weight)
  const name1 = normalizeText(event1.name || event1.title);
  const name2 = normalizeText(event2.name || event2.title);
  
  if (name1 && name2) {
    scores.name = stringSimilarity.compareTwoStrings(name1, name2);
  }
  
  // 2. URL SIMILARITY (Definitive - 100% weight if match)
  const url1 = normalizeUrl(event1.url || event1.externalRedirectUrl || '');
  const url2 = normalizeUrl(event2.url || event2.externalRedirectUrl || '');
  
  if (url1 && url2) {
    if (url1 === url2) {
      scores.url = 1.0;
    } else {
      scores.url = stringSimilarity.compareTwoStrings(url1, url2);
    }
  }
  
  // 3. DATE SIMILARITY (20% weight)
  const date1 = extractDate(event1);
  const date2 = extractDate(event2);
  
  if (date1 && date2) {
    const daysDiff = Math.abs(differenceInDays(date1, date2));
    scores.date = daysDiff <= DATE_THRESHOLD_DAYS ? 1.0 : Math.max(0, 1 - (daysDiff / 30));
  }
  
  // 4. LOCATION SIMILARITY (10% weight)
  const location1 = normalizeText([
    event1.city,
    event1.location,
    event1.venue,
    event1.address1
  ].filter(Boolean).join(' '));
  
  const location2 = normalizeText([
    event2.city,
    event2.location,
    event2.venue,
    event2.address1
  ].filter(Boolean).join(' '));
  
  if (location1 && location2) {
    scores.location = stringSimilarity.compareTwoStrings(location1, location2);
  }
  
  // CALCULATE OVERALL SCORE
  // If URLs match exactly, it's definitely a duplicate
  if (scores.url === 1.0) {
    scores.overall = 1.0;
  } else {
    // Weighted average
    const weights = {
      name: 0.5,
      date: 0.2,
      location: 0.15,
      url: 0.15
    };
    
    scores.overall = 
      (scores.name * weights.name) +
      (scores.date * weights.date) +
      (scores.location * weights.location) +
      (scores.url * weights.url);
  }
  
  return scores;
}

// ==================== DETECT DUPLICATES ====================
function detectDuplicates(events) {
  console.log(`\n🔍 Checking ${events.length} events for duplicates...`);
  
  const duplicateGroups = [];
  const processed = new Set();
  
  for (let i = 0; i < events.length; i++) {
    if (processed.has(i)) continue;
    
    const currentEvent = events[i];
    const group = [i];
    
    // Compare with all subsequent events
    for (let j = i + 1; j < events.length; j++) {
      if (processed.has(j)) continue;
      
      const compareEvent = events[j];
      const similarity = calculateSimilarity(currentEvent, compareEvent);
      
      // If similarity is above threshold, it's a duplicate
      if (similarity.overall >= SIMILARITY_THRESHOLD) {
        group.push(j);
        processed.add(j);
        
        console.log(`  📎 Duplicate found: "${currentEvent.name}" ≈ "${compareEvent.name}" (${(similarity.overall * 100).toFixed(1)}%)`);
      }
    }
    
    if (group.length > 1) {
      duplicateGroups.push(group);
    }
    processed.add(i);
  }
  
  return duplicateGroups;
}

// ==================== MERGE DUPLICATE EVENTS ====================
function mergeDuplicates(events, duplicateGroups) {
  console.log(`\n🔀 Merging ${duplicateGroups.length} duplicate groups...`);
  
  const mergedEvents = [];
  const skipIndices = new Set();
  
  // For each duplicate group, keep the best one
  for (const group of duplicateGroups) {
    const groupEvents = group.map(idx => events[idx]);
    
    // Choose the event with most complete data
    const best = groupEvents.reduce((best, current) => {
      const bestScore = scoreCompleteness(best);
      const currentScore = scoreCompleteness(current);
      return currentScore > bestScore ? current : best;
    });
    
    // Merge data from all events in group
    const merged = { ...best };
    
    for (const event of groupEvents) {
      // Fill in missing fields from duplicates
      Object.keys(event).forEach(key => {
        if (!merged[key] && event[key]) {
          merged[key] = event[key];
        }
      });
      
      // Merge arrays
      if (event.images && Array.isArray(event.images)) {
        merged.images = [...new Set([...(merged.images || []), ...event.images])];
      }
      if (event.categoryIds && Array.isArray(event.categoryIds)) {
        merged.categoryIds = [...new Set([...(merged.categoryIds || []), ...event.categoryIds])];
      }
      if (event.features && Array.isArray(event.features)) {
        merged.features = [...new Set([...(merged.features || []), ...event.features])];
      }
    }
    
    mergedEvents.push(merged);
    
    // Mark all group members as processed except the best one
    group.forEach(idx => skipIndices.add(idx));
  }
  
  // Add all non-duplicate events
  events.forEach((event, idx) => {
    if (!skipIndices.has(idx)) {
      // Check if this event wasn't already added as a merged event
      const alreadyAdded = mergedEvents.some(merged => 
        merged.name === event.name && merged.url === event.url
      );
      if (!alreadyAdded) {
        mergedEvents.push(event);
      }
    }
  });
  
  return mergedEvents;
}

// ==================== SCORE COMPLETENESS ====================
function scoreCompleteness(event) {
  let score = 0;
  
  // Essential fields
  if (event.name) score += 2;
  if (event.description) score += 2;
  if (event.startDate) score += 2;
  if (event.url || event.externalRedirectUrl) score += 1;
  
  // Location fields
  if (event.city) score += 1;
  if (event.venue) score += 1;
  if (event.address1) score += 1;
  if (event.latitude && event.longitude) score += 1;
  
  // Additional info
  if (event.images && event.images.length > 0) score += 1;
  if (event.categoryIds && event.categoryIds.length > 0) score += 1;
  if (event.features && event.features.length > 0) score += 1;
  if (event.tickets && event.tickets.length > 0) score += 1;
  if (event.socialMedias && (event.socialMedias.facebook || event.socialMedias.twitter)) score += 1;
  
  return score;
}

// ==================== REMOVE DUPLICATES ====================
export function removeDuplicates(events) {
  if (!events || events.length === 0) {
    console.log('⚠️  No events to check for duplicates');
    return events;
  }
  
  const duplicateGroups = detectDuplicates(events);
  
  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!');
    return events;
  }
  
  const uniqueEvents = mergeDuplicates(events, duplicateGroups);
  
  console.log(`\n✅ Removed ${events.length - uniqueEvents.length} duplicates`);
  console.log(`📊 Final count: ${uniqueEvents.length} unique events`);
  
  return uniqueEvents;
}

// ==================== CHECK AGAINST EXISTING EVENTS ====================
export function filterExistingEvents(newEvents, existingEventsFile = './output.json') {
  if (!fs.existsSync(existingEventsFile)) {
    console.log('ℹ️  No existing events file found, all events are new');
    return newEvents;
  }
  
  try {
    const existingData = JSON.parse(fs.readFileSync(existingEventsFile, 'utf-8'));
    const existingEvents = Array.isArray(existingData) ? existingData : [];
    
    console.log(`\n🔍 Checking against ${existingEvents.length} existing events...`);
    
    const trulyNewEvents = newEvents.filter(newEvent => {
      // Check if this event already exists
      const isDuplicate = existingEvents.some(existing => {
        const similarity = calculateSimilarity(newEvent, existing);
        return similarity.overall >= SIMILARITY_THRESHOLD;
      });
      
      return !isDuplicate;
    });
    
    const filtered = newEvents.length - trulyNewEvents.length;
    console.log(`✅ Filtered out ${filtered} events that already exist`);
    console.log(`📊 New events to add: ${trulyNewEvents.length}`);
    
    return trulyNewEvents;
  } catch (error) {
    console.error('Error reading existing events:', error.message);
    return newEvents;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const events = JSON.parse(fs.readFileSync('./scraped-raw.json', 'utf-8'));
  const unique = removeDuplicates(events);
  fs.writeFileSync('./scraped-unique.json', JSON.stringify(unique, null, 2));
  console.log('\n💾 Saved to scraped-unique.json');
}

