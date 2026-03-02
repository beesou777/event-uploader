import fs from 'fs';
import { scrapeAllSources } from './scraper.js';
import { removeDuplicates, filterExistingEvents } from './duplicate-detector.js';
import { convertAllEvents } from './ai-converter.js';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { checkIfEventExists, closePool } from './db-utils.js';

// Load environment variables from .env file
dotenv.config();

// ==================== CONFIGURATION ====================
const CONFIG = {
  API_URL: process.env.API_URL || "https://eventeir-backend.ambitiouscliff-a806dce8.eastus.azurecontainerapps.io/api/v1/events/create/v2",
  ACCESS_TOKEN: process.env.ACCESS_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InNoYWhiaXNod2EyMUBnbWFpbC5jb20iLCJmdWxsTmFtZSI6ImJpc2h3YSBzaGFoIiwiZ2VuZGVyIjpudWxsLCJpZCI6Miwicm9sZSI6Ik9SR0FOSVpFUiIsImlhdCI6MTc2NDE2NzEyMywiZXhwIjoxNzY0MTgxNTIzfQ.GD3Jd9_uO9fszSHClw6aC7Pt-7ppE67tPnXctrjhd9o",
  FILES: {
    scraped: './scraped-raw.json',
    unique: './scraped-unique.json',
    converted: './output.json',
    uploaded: './uploader-event.json'
  },
  AUTO_UPLOAD: process.env.AUTO_UPLOAD === 'true' || false,
  MAX_EVENTS_PER_RUN: 50
};

// ==================== FETCH IMAGE AS BUFFER ====================
async function fetchImageAsBuffer(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    return { buffer, contentType };
  } catch (error) {
    console.error(`Failed to fetch image ${imageUrl}:`, error.message);
    return null;
  }
}

// ==================== BUILD FORM DATA ====================
async function buildFormData(eventData) {
  const form = new FormData();
  
  // Helper function
  const safeAppend = (key, value) => {
    if (value !== null && value !== undefined) {
      form.append(key, String(value));
    }
  };
  
  // Event details
  const eventDetails = {
    description: eventData.description,
    name: eventData.name,
    isPhysical: eventData.isPhysical,
    additionalInfo: eventData.additionalInfo,
    theme: eventData.theme,
    lang: eventData.lang,
    startDate: eventData.startDate,
    endDate: eventData.endDate,
    venue: eventData.venue,
    city: eventData.city,
    state: eventData.state,
    country: eventData.country,
    address1: eventData.address1,
    address2: eventData.address2,
    longitude: eventData.longitude,
    latitude: eventData.latitude,
    externalRedirectUrl: eventData.externalRedirectUrl,
    capacity: eventData.capacity || 100,
    platform: eventData.platform || "",
    startTime: eventData.startTime,
    endTime: eventData.endTime,
    slug: eventData.slug,
    fromPrice: eventData.fromPrice,
    ticketCurrency: eventData.ticketCurrency,
    isDraft: eventData.isDraft,
    isFree: eventData.isFree,
    isDeleted: eventData.isDeleted,
    isCreatedByVerifiedUser: eventData.isCreatedByVerifiedUser,
    recievePayment: eventData.recievePayment,
    creatorId: eventData.creatorId,
    subscriptionPlanId: eventData.subscriptionPlanId || 1
  };
  
  Object.entries(eventDetails).forEach(([key, value]) => {
    safeAppend(`eventDetails[${key}]`, value);
  });
  
  // Only add features if array has valid strings
  if (eventData.features && Array.isArray(eventData.features) && eventData.features.length > 0) {
    eventData.features.forEach((f, i) => {
      if (f && typeof f === 'string' && f.trim() !== '') {
        safeAppend(`eventDetails[features][${i}]`, f);
      }
    });
  }
  
  // Category IDs
  eventData.categoryIds?.forEach((c, i) => {
    safeAppend(`eventDetails[categoryIds][${i}]`, c);
  });
  
  // FAQs
  eventData.faqs?.forEach((faq, i) => {
    safeAppend(`eventDetails[faqs][${i}][question]`, faq.question);
    safeAppend(`eventDetails[faqs][${i}][answer]`, faq.answer);
  });
  
  // Audience
  eventData.audience?.forEach((a, i) => {
    safeAppend(`eventDetails[audience][${i}]`, a);
  });
  
  // Refund policy & currency
  safeAppend("refundPolicy", eventData.refundPolicy || "");
  safeAppend("ticket_currency", "NOK");
  safeAppend("subscriptionPlanId", 1);
  
  // Tickets
  const ticketsArray = Array.isArray(eventData.tickets)
    ? eventData.tickets
    : eventData.ticket
    ? [eventData.ticket]
    : [];
  
  ticketsArray.forEach((ticket, i) => {
    safeAppend(`tickets[${i}][name]`, ticket.name || "General Admission");
    safeAppend(`tickets[${i}][description]`, ticket.description || "");
    safeAppend(`tickets[${i}][price]`, Math.floor(ticket.price || 0));
    safeAppend(`tickets[${i}][maximumTicketCapacity]`, ticket.maximumTicketCapacity || 100);
  });
  
  // Handle images - only add valid image URLs
  let imageAdded = false;
  if (eventData.images && eventData.images.length > 0) {
    for (let i = 0; i < Math.min(eventData.images.length, 3); i++) {
      const imageUrl = eventData.images[i];
      if (imageUrl && typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        const imageFile = await fetchImageAsBuffer(imageUrl);
        if (imageFile) {
          form.append("images", imageFile.buffer, {
            filename: `image-${i}.jpg`,
            contentType: imageFile.contentType,
          });
          imageAdded = true;
        }
      }
    }
  }
  
  // If no images were added, create a placeholder to satisfy API requirements
  if (!imageAdded) {
    // Create a minimal 1x1 transparent PNG as placeholder
    const placeholderImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    form.append("images", placeholderImage, {
      filename: 'placeholder.png',
      contentType: 'image/png',
    });
  }
  
  return form;
}

// ==================== UPLOAD SINGLE EVENT ====================
async function uploadEvent(eventData) {
  const form = await buildFormData(eventData);
  
  const res = await axios.post(CONFIG.API_URL, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${CONFIG.ACCESS_TOKEN}`,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  
  return res.data;
}

// ==================== NORMALIZE URL FOR COMPARISON ====================
function normalizeUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    // Remove query params and fragments for comparison (they don't affect uniqueness)
    return `${urlObj.origin}${urlObj.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().trim();
  }
}

// ==================== CHECK IF EVENT IS ALREADY UPLOADED ====================
function isEventUploaded(event, uploadedLog) {
  const eventUrl = normalizeUrl(event.externalRedirectUrl || event.url || '');
  const eventName = (event.name || '').toLowerCase().trim();
  
  return uploadedLog.some(log => {
    const logUrl = normalizeUrl(log.externalRedirectUrl || '');
    const logName = (log.name || '').toLowerCase().trim();
    
    // Primary check: URL match (most reliable)
    if (eventUrl && logUrl && eventUrl === logUrl) {
      return true;
    }
    
    // Secondary check: Name + URL similarity (for cases where URL might have changed slightly)
    if (eventName && logName && eventName === logName && eventUrl && logUrl) {
      // If names match exactly and URLs are similar, consider it uploaded
      return true;
    }
    
    return false;
  });
}

// ==================== LOAD UPLOADED LOG ====================
function loadUploadedLog() {
  if (fs.existsSync(CONFIG.FILES.uploaded)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG.FILES.uploaded, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

// ==================== SAVE UPLOADED LOG ====================
function saveUploadedLog(log) {
  fs.writeFileSync(CONFIG.FILES.uploaded, JSON.stringify(log, null, 2));
}

// ==================== UPLOAD EVENTS ====================
async function uploadEvents(events, autoApprove = false) {
  console.log(`\n📤 Preparing to upload ${events.length} events...`);
  
  if (!autoApprove) {
    console.log('\n⚠️  AUTO_UPLOAD is disabled. Set AUTO_UPLOAD=true in environment to enable automatic upload.');
    console.log('   Or run manual-upload.js to review and upload events manually.\n');
    return { uploaded: 0, failed: 0 };
  }
  
  const uploadedLog = loadUploadedLog();
  let uploaded = 0;
  let failed = 0;
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // Check if already uploaded (using improved URL matching)
    const alreadyUploaded = isEventUploaded(event, uploadedLog);
    
    if (alreadyUploaded) {
      console.log(`⏭️  [${i + 1}/${events.length}] Skipping (already uploaded): ${event.name}`);
      continue;
    }
    
    try {
      console.log(`📤 [${i + 1}/${events.length}] Uploading: ${event.name}`);
      
      const result = await uploadEvent(event);
      
      uploadedLog.push({
        name: event.name,
        externalRedirectUrl: event.externalRedirectUrl,
        uploadedAt: new Date().toISOString(),
        result: result
      });
      
      uploaded++;
      console.log(`✅ SUCCESS\n`);
      
      // Save log after each upload
      saveUploadedLog(uploadedLog);
      
      // Rate limiting - wait 2 seconds between uploads
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (err) {
      failed++;
      console.error(`❌ ERROR: ${err.message}`);
      if (err.response?.data) {
        console.error('   Response:', JSON.stringify(err.response.data, null, 2));
      }
      console.log();
    }
    
    // Stop if we hit the max events per run
    if (uploaded >= CONFIG.MAX_EVENTS_PER_RUN) {
      console.log(`\n⚠️  Reached maximum events per run (${CONFIG.MAX_EVENTS_PER_RUN}). Stopping.`);
      break;
    }
  }
  
  return { uploaded, failed };
}

// ==================== MAIN PIPELINE ====================
async function runPipeline() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 NORWAY TECH EVENTS - AUTOMATED PIPELINE              ║');
  console.log('║  Scrape → Deduplicate → Convert → Upload                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // STEP 1: SCRAPE
    console.log('📍 STEP 1: SCRAPING EVENTS FROM MULTIPLE SOURCES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let scrapedEvents = [];
    
    if (fs.existsSync(CONFIG.FILES.scraped)) {
      const fileContent = fs.readFileSync(CONFIG.FILES.scraped, 'utf-8').trim();
      if (fileContent === '' || fileContent === '{}' || fileContent === '[]') {
        console.log(`⚠️  Found empty scraped data file: ${CONFIG.FILES.scraped}`);
        console.log('   Deleting and scraping fresh...');
        fs.unlinkSync(CONFIG.FILES.scraped);
        scrapedEvents = await scrapeAllSources();
        fs.writeFileSync(CONFIG.FILES.scraped, JSON.stringify(scrapedEvents, null, 2));
      } else {
        console.log(`ℹ️  Found existing scraped data: ${CONFIG.FILES.scraped}`);
        console.log('   Loading from file... (delete to scrape fresh)');
        scrapedEvents = JSON.parse(fileContent);
      }
    } else {
      scrapedEvents = await scrapeAllSources();
      fs.writeFileSync(CONFIG.FILES.scraped, JSON.stringify(scrapedEvents, null, 2));
    }
    
    console.log(`✅ Loaded ${scrapedEvents.length} scraped events\n`);
    
    // STEP 2: REMOVE DUPLICATES
    console.log('📍 STEP 2: DUPLICATE DETECTION & REMOVAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const uniqueEvents = removeDuplicates(scrapedEvents);
    fs.writeFileSync(CONFIG.FILES.unique, JSON.stringify(uniqueEvents, null, 2));
    
    // Don't check against existing - we're replacing the entire dataset
    console.log(`\n✅ ${uniqueEvents.length} unique events ready for conversion\n`);
    
    // STEP 3: CONVERT TO SCHEMA (with AI transformation)
    console.log('📍 STEP 3: CONVERTING TO EVENT SCHEMA (AI-Powered)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Scraped data saved to:', CONFIG.FILES.scraped);
    console.log('   Now transforming with AI...\n');
    
    const convertedEvents = await convertAllEvents(uniqueEvents);
    
    // Load uploaded log to filter out already-uploaded events
    console.log(`\n🔍 Checking against database for existing events...`);
    
    // Filter out events that are already in the database
    const newEvents = [];
    for (const event of convertedEvents) {
      const exists = await checkIfEventExists(event.externalRedirectUrl);
      if (!exists) {
        newEvents.push(event);
      }
    }
    
    const alreadyUploadedCount = convertedEvents.length - newEvents.length;
    if (alreadyUploadedCount > 0) {
      console.log(`⏭️  Filtered out ${alreadyUploadedCount} events already in database`);
    }
    
    // Save new events to output.json (overwrite existing as we want fresh new ones)
    fs.writeFileSync(CONFIG.FILES.converted, JSON.stringify(newEvents, null, 2));
    
    console.log(`\n✅ Total events ready for manual verification: ${newEvents.length}`);
    console.log(`   📂 Output saved to: ${CONFIG.FILES.converted}`);
    console.log();
    
    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  📊 PIPELINE SUMMARY                                      ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Scraped:           ${String(scrapedEvents.length).padEnd(37)} ║`);
    console.log(`║  After dedup:       ${String(uniqueEvents.length).padEnd(37)} ║`);
    console.log(`║  Converted:         ${String(convertedEvents.length).padEnd(37)} ║`);
    console.log(`║  New (not in DB):   ${String(newEvents.length).padEnd(37)} ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // NEXT STEPS
    console.log('💡 NEXT STEPS:');
    console.log('   1. Review events in: output.json');
    console.log('   2. Run: npm run manual-upload  (to review & upload manually)\n');
    
    console.log('✨ Pipeline completed successfully!\n');
    
    // Close DB Pool
    await closePool();
    
  } catch (error) {
    console.error('\n❌ Pipeline Error:', error.message);
    console.error(error.stack);
    await closePool();
    process.exit(1);
  }
}

// Run pipeline
runPipeline();

