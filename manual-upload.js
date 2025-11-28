import fs from 'fs';
import promptSync from 'prompt-sync';
import axios from 'axios';
import FormData from 'form-data';
import { MAIN_CATEGORIES } from './ai-converter.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prompt = promptSync({ sigint: true });

// ==================== CONFIGURATION ====================
const CONFIG = {
  API_URL: process.env.API_URL,
  ACCESS_TOKEN: process.env.ACCESS_TOKEN,
  FILES: {
    converted: './output.json',
    uploaded: './uploaded-log.json'
  }
};

console.log(CONFIG);

// ==================== DISPLAY EVENT ====================
function displayEvent(event, index, total) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log(`║  Event ${index + 1}/${total}                                               ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Name: ${event.name.substring(0, 48).padEnd(48)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  // Categories
  const categories = event.categoryIds
    .map(id => MAIN_CATEGORIES.find(c => c.id === id)?.name || `ID:${id}`)
    .join(', ');
  console.log(`  📂 Categories: ${categories}`);
  
  // Location
  console.log(`  📍 Location: ${event.city}, ${event.country}`);
  console.log(`  🏢 Venue: ${event.venue || 'N/A'}`);
  
  // Date
  console.log(`  📅 Start: ${new Date(event.startDate).toLocaleString()}`);
  console.log(`  📅 End: ${new Date(event.endDate).toLocaleString()}`);
  
  // Type
  console.log(`  🌐 Type: ${event.isPhysical ? 'Physical' : 'Online'}`);
  
  // Tickets
  if (event.tickets && event.tickets.length > 0) {
    const ticket = event.tickets[0];
    console.log(`  🎫 Ticket: ${ticket.isFree ? 'FREE' : `${ticket.price} ${ticket.currency}`}`);
  }
  
  // Description
  const desc = event.description || 'No description';
  console.log(`\n  📝 Description:`);
  console.log(`  ${desc.substring(0, 200)}${desc.length > 200 ? '...' : ''}`);
  
  // Features
  if (event.features && event.features.length > 0) {
    console.log(`\n  ✨ Features (${event.features.length}):`);
    event.features.slice(0, 3).forEach((f, i) => {
      console.log(`     ${i + 1}. ${f.substring(0, 50)}${f.length > 50 ? '...' : ''}`);
    });
  }
  
  // Social Media
  const socials = Object.entries(event.socialMedias || {})
    .filter(([_, v]) => v)
    .map(([k, _]) => k);
  if (socials.length > 0) {
    console.log(`  🔗 Social: ${socials.join(', ')}`);
  }
  
  // External URL
  console.log(`  🌐 URL: ${event.externalRedirectUrl || 'N/A'}`);
  
  console.log('╚════════════════════════════════════════════════════════════╝');
}

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
    return null;
  }
}

// ==================== BUILD FORM DATA ====================
async function buildFormData(eventData) {
  const form = new FormData();
  
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
    platform: eventData.platform || ""
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
  
  eventData.categoryIds?.forEach((c, i) => {
    safeAppend(`eventDetails[categoryIds][${i}]`, c);
  });
  
  eventData.faqs?.forEach((faq, i) => {
    safeAppend(`eventDetails[faqs][${i}][question]`, faq.question);
    safeAppend(`eventDetails[faqs][${i}][answer]`, faq.answer);
  });
  
  eventData.audience?.forEach((a, i) => {
    safeAppend(`eventDetails[audience][${i}]`, a);
  });
  
  safeAppend("refundPolicy", eventData.refundPolicy || "");
  safeAppend("ticket_currency", "NOK");
  safeAppend("subscriptionPlanId", 1);
  
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

// ==================== UPLOAD EVENT ====================
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
    // Remove query params and fragments for comparison
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
    
    // Secondary check: Name + URL similarity
    if (eventName && logName && eventName === logName && eventUrl && logUrl) {
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

// ==================== MAIN INTERACTIVE UPLOAD ====================
async function interactiveUpload() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🎯 MANUAL EVENT UPLOAD INTERFACE                        ║');
  console.log('║  Review and approve events before uploading               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Load events
  if (!fs.existsSync(CONFIG.FILES.converted)) {
    console.log('❌ No events found in output.json');
    console.log('   Run: npm run full-pipeline first\n');
    return;
  }
  
  const events = JSON.parse(fs.readFileSync(CONFIG.FILES.converted, 'utf-8'));
  const uploadedLog = loadUploadedLog();
  
  // Filter out already uploaded (using improved URL matching)
  const pendingEvents = events.filter(event => {
    return !isEventUploaded(event, uploadedLog);
  });
  
  if (pendingEvents.length === 0) {
    console.log('🎉 All events have been uploaded!');
    console.log(`   Total: ${events.length} events`);
    console.log(`   Uploaded: ${uploadedLog.length} events\n`);
    return;
  }
  
  console.log(`📊 Status:`);
  console.log(`   Total events: ${events.length}`);
  console.log(`   Already uploaded: ${uploadedLog.length}`);
  console.log(`   Pending: ${pendingEvents.length}\n`);
  
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < pendingEvents.length; i++) {
    const event = pendingEvents[i];
    
    displayEvent(event, i, pendingEvents.length);
    
    console.log('\n📋 Options:');
    console.log('   [Y] Upload this event');
    console.log('   [N] Skip this event');
    console.log('   [E] Edit event (open in editor)');
    console.log('   [A] Upload All remaining');
    console.log('   [Q] Quit\n');
    
    const choice = prompt('Your choice: ').toLowerCase();
    
    if (choice === 'q') {
      console.log('\n👋 Exiting...\n');
      break;
    } else if (choice === 'a') {
      console.log('\n📤 Uploading all remaining events...\n');
      
      for (let j = i; j < pendingEvents.length; j++) {
        const e = pendingEvents[j];
        try {
          console.log(`📤 [${j + 1}/${pendingEvents.length}] ${e.name}`);
          const result = await uploadEvent(e);
          
          uploadedLog.push({
            name: e.name,
            externalRedirectUrl: e.externalRedirectUrl,
            uploadedAt: new Date().toISOString(),
            result: result
          });
          
          uploaded++;
          console.log('✅ SUCCESS\n');
          saveUploadedLog(uploadedLog);
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          failed++;
          console.error(`❌ ERROR: ${err.message}\n`);
        }
      }
      break;
    } else if (choice === 'y') {
      try {
        console.log('\n📤 Uploading...');
        const result = await uploadEvent(event);
        
        uploadedLog.push({
          name: event.name,
          externalRedirectUrl: event.externalRedirectUrl,
          uploadedAt: new Date().toISOString(),
          result: result
        });
        
        uploaded++;
        console.log('✅ SUCCESS!\n');
        saveUploadedLog(uploadedLog);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        failed++;
        console.error(`❌ ERROR: ${err.message}`);
        if (err.response?.data) {
          console.error('Response:', JSON.stringify(err.response.data, null, 2));
        }
        console.log();
      }
    } else if (choice === 'e') {
      console.log('\n📝 Edit mode: Manually edit output.json and restart this script\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else if (choice === 'n') {
      skipped++;
      console.log('\n⏭️  Skipped\n');
    }
  }
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  📊 UPLOAD SUMMARY                                        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Uploaded:          ${String(uploaded).padEnd(37)} ║`);
  console.log(`║  Skipped:           ${String(skipped).padEnd(37)} ║`);
  console.log(`║  Failed:            ${String(failed).padEnd(37)} ║`);
  console.log(`║  Remaining:         ${String(pendingEvents.length - uploaded - skipped - failed).padEnd(37)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Run
interactiveUpload().catch(console.error);

