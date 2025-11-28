import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

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

// ==================== MAIN CLEANUP ====================
function cleanupOutput() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🧹 CLEANING UP OUTPUT.JSON                               ║');
  console.log('║  Removing already-uploaded events                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Load files
  if (!fs.existsSync('./output.json')) {
    console.log('❌ output.json not found!\n');
    return;
  }
  
  if (!fs.existsSync('./uploader-event.json')) {
    console.log('⚠️  uploader-event.json not found. No events to filter.\n');
    return;
  }
  
  const outputEvents = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));
  const uploadedLog = JSON.parse(fs.readFileSync('./uploader-event.json', 'utf-8'));
  
  console.log(`📊 Current status:`);
  console.log(`   Events in output.json: ${outputEvents.length}`);
  console.log(`   Events in uploader-event.json: ${uploadedLog.length}\n`);
  
  // Filter out already-uploaded events
  const filteredEvents = outputEvents.filter(event => {
    return !isEventUploaded(event, uploadedLog);
  });
  
  const removedCount = outputEvents.length - filteredEvents.length;
  
  if (removedCount === 0) {
    console.log('✅ No events to remove. All events are new!\n');
    return;
  }
  
  // Save cleaned output.json
  fs.writeFileSync('./output.json', JSON.stringify(filteredEvents, null, 2));
  
  console.log(`\n✅ Cleanup complete!`);
  console.log(`   Removed: ${removedCount} already-uploaded events`);
  console.log(`   Remaining: ${filteredEvents.length} events ready to upload\n`);
  
  if (filteredEvents.length === 0) {
    console.log('🎉 All events have been uploaded! output.json is now empty.\n');
  }
}

// Run cleanup
cleanupOutput();

