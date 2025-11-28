# 📖 Usage Examples & Scenarios

Real-world examples of how to use the Norway Tech Events scraper system.

## 🎯 Scenario 1: First Time Setup

**Goal**: Get started from scratch

```bash
# 1. Install dependencies
npm install

# 2. Check configuration
cat .env

# 3. Run first scrape
npm run full-pipeline

# Expected output:
# ✅ 50-200 events scraped
# ✅ Duplicates removed (10-30%)
# ✅ Events converted to schema
# ✅ Saved to output.json
```

**Next Step**: Review events before uploading
```bash
npm run manual-upload
```

---

## 🎯 Scenario 2: Daily Automated Updates

**Goal**: Run daily to get new events automatically

### Setup (One Time)

Create a batch file `daily-update.bat`:

```batch
@echo off
cd "C:\Users\bishwa shah\OneDrive\Desktop\COVERTER"
npm run full-pipeline
```

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Norway Tech Events Scraper"
4. Trigger: Daily at 9:00 AM
5. Action: Start a program
6. Program: `C:\path\to\daily-update.bat`

### Manual Review Later

```bash
# Review and upload new events
npm run manual-upload
```

---

## 🎯 Scenario 3: Fully Automated (No Review)

**Goal**: Complete automation with auto-upload

### Enable Auto-Upload

Edit `.env`:
```env
AUTO_UPLOAD=true
MAX_EVENTS_PER_RUN=50
```

### Run Pipeline

```bash
npm run full-pipeline
```

**Result**: Events are scraped, converted, and uploaded automatically!

---

## 🎯 Scenario 4: Manual Event Addition

**Goal**: Add events manually without scraping

### Create Manual Event

Create `manual-events.json`:

```json
[
  {
    "name": "Oslo AI Summit 2024",
    "description": "The biggest AI conference in Norway",
    "url": "https://example.com/ai-summit",
    "location": "Oslo",
    "city": "Oslo",
    "country": "Norway",
    "venue": "Oslo Conference Center",
    "startDate": "2024-12-15T09:00:00",
    "endDate": "2024-12-15T17:00:00",
    "priceText": "500 NOK",
    "isPhysical": true,
    "image": "https://example.com/image.jpg"
  }
]
```

### Convert and Upload

```javascript
// manual-convert.js
import { convertAllEvents } from './ai-converter.js';
import fs from 'fs';

const manualEvents = JSON.parse(fs.readFileSync('./manual-events.json', 'utf-8'));
const converted = convertAllEvents(manualEvents);

// Append to output.json
const existing = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));
const combined = [...existing, ...converted];
fs.writeFileSync('./output.json', JSON.stringify(combined, null, 2));

console.log('✅ Manual events added to output.json');
```

```bash
node manual-convert.js
npm run manual-upload
```

---

## 🎯 Scenario 5: Scrape Only Specific Sources

**Goal**: Test individual scrapers

### Modify `scraper.js`

Comment out unwanted scrapers:

```javascript
const scrapers = [
  scrapeEventbrite(),      // Keep
  // scrapeMeetup(),       // Disable
  // scrapeFinnEvents(),   // Disable
  // scrapeTechCommunities(), // Disable
  // scrapeGenericEventSites() // Disable
];
```

### Run Scraper

```bash
npm run scrape
```

---

## 🎯 Scenario 6: Filter by Category

**Goal**: Only upload events from specific categories

### Filter Events

```javascript
// filter-category.js
import fs from 'fs';

const events = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));

// Only Tech & AI (category 1) and Innovation & Future (category 5)
const filtered = events.filter(e => 
  e.categoryIds.includes(1) || e.categoryIds.includes(5)
);

fs.writeFileSync('./output-filtered.json', JSON.stringify(filtered, null, 2));
console.log(`Filtered: ${filtered.length}/${events.length} events`);
```

```bash
node filter-category.js
# Then manually edit manual-upload.js to use output-filtered.json
```

---

## 🎯 Scenario 7: Bulk Edit Events

**Goal**: Add missing information to all events

### Add Venue to All Oslo Events

```javascript
// bulk-edit.js
import fs from 'fs';

const events = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));

events.forEach(event => {
  if (event.city === 'Oslo' && !event.venue) {
    event.venue = 'To be announced';
  }
  
  // Add default FAQ
  if (event.faqs.length === 0) {
    event.faqs.push({
      question: 'Where can I find more information?',
      answer: `Visit ${event.externalRedirectUrl} for full details.`
    });
  }
});

fs.writeFileSync('./output.json', JSON.stringify(events, null, 2));
console.log('✅ Bulk edits applied');
```

```bash
node bulk-edit.js
```

---

## 🎯 Scenario 8: Re-categorize Events

**Goal**: Manually adjust categories

### Edit Categories

```javascript
// recategorize.js
import fs from 'fs';

const events = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));

events.forEach(event => {
  const name = event.name.toLowerCase();
  
  // If event has "hackathon" in name, ensure it has Networking category
  if (name.includes('hackathon') && !event.categoryIds.includes(4)) {
    event.categoryIds.push(4);
  }
  
  // If event has "workshop" in name, ensure it has Career & Learning category
  if (name.includes('workshop') && !event.categoryIds.includes(3)) {
    event.categoryIds.push(3);
  }
});

fs.writeFileSync('./output.json', JSON.stringify(events, null, 2));
console.log('✅ Events re-categorized');
```

```bash
node recategorize.js
```

---

## 🎯 Scenario 9: Export for Analysis

**Goal**: Analyze events before uploading

### Export to CSV

```javascript
// export-csv.js
import fs from 'fs';

const events = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));

const csv = [
  'Name,City,Date,Category,Price,URL',
  ...events.map(e => {
    const category = e.categoryIds[0] || 'N/A';
    const price = e.tickets[0]?.price || 0;
    return `"${e.name}","${e.city}","${e.startDate}","${category}","${price}","${e.externalRedirectUrl}"`;
  })
].join('\n');

fs.writeFileSync('./events-analysis.csv', csv);
console.log('✅ Exported to events-analysis.csv');
```

```bash
node export-csv.js
# Open events-analysis.csv in Excel
```

---

## 🎯 Scenario 10: Scheduled Weekly Digest

**Goal**: Get a weekly summary of new events

### Create Summary Script

```javascript
// weekly-summary.js
import fs from 'fs';
import { format } from 'date-fns';

const events = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));
const uploadLog = JSON.parse(fs.readFileSync('./uploaded-log.json', 'utf-8'));

// Events from last 7 days
const oneWeekAgo = new Date();
oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

const recentEvents = events.filter(e => {
  const eventDate = new Date(e.startDate);
  return eventDate > oneWeekAgo;
});

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  📊 WEEKLY TECH EVENTS SUMMARY                   ║');
console.log('╠════════════════════════════════════════════════════╣');
console.log(`║  Total Events: ${String(events.length).padEnd(34)}║`);
console.log(`║  New This Week: ${String(recentEvents.length).padEnd(33)}║`);
console.log(`║  Uploaded: ${String(uploadLog.length).padEnd(38)}║`);
console.log('╚════════════════════════════════════════════════════╝\n');

console.log('📅 Upcoming Events:\n');
recentEvents.slice(0, 10).forEach((e, i) => {
  console.log(`${i + 1}. ${e.name}`);
  console.log(`   📍 ${e.city} | 📅 ${format(new Date(e.startDate), 'MMM dd, yyyy')}`);
  console.log(`   🔗 ${e.externalRedirectUrl}\n`);
});
```

```bash
node weekly-summary.js
```

---

## 🎯 Scenario 11: Reset Everything

**Goal**: Start fresh, delete all data

```bash
# Delete generated files (keep source code)
rm scraped-raw.json
rm scraped-unique.json
rm output.json
rm uploaded-log.json

# Run fresh scrape
npm run full-pipeline
```

**Warning**: This will lose upload history!

---

## 🎯 Scenario 12: Test with Sample Data

**Goal**: Test upload without scraping real events

### Create Test Event

```json
// test-event.json
[
  {
    "name": "Test Event - DELETE AFTER TESTING",
    "description": "This is a test event",
    "url": "https://example.com/test",
    "location": "Oslo",
    "city": "Oslo",
    "country": "Norway",
    "startDate": "2024-12-01T10:00:00",
    "endDate": "2024-12-01T12:00:00"
  }
]
```

### Convert and Upload

```bash
node ai-converter.js test-event.json
npm run manual-upload
```

---

## 🎯 Scenario 13: Backup Before Upload

**Goal**: Keep backups before uploading

```bash
# Create backup directory
mkdir backups

# Backup with timestamp
cp output.json "backups/output-$(date +%Y%m%d-%H%M%S).json"

# Upload
npm run manual-upload
```

---

## 🎯 Scenario 14: Monitor Upload Progress

**Goal**: Track upload success rate

```javascript
// upload-stats.js
import fs from 'fs';

const uploadLog = JSON.parse(fs.readFileSync('./uploaded-log.json', 'utf-8'));

const stats = {
  total: uploadLog.length,
  today: 0,
  thisWeek: 0,
  byCategory: {}
};

const now = new Date();
const today = now.toISOString().split('T')[0];
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

uploadLog.forEach(log => {
  const logDate = log.uploadedAt.split('T')[0];
  if (logDate === today) stats.today++;
  if (new Date(log.uploadedAt) > oneWeekAgo) stats.thisWeek++;
});

console.log('📊 Upload Statistics:');
console.log(`   Total: ${stats.total}`);
console.log(`   Today: ${stats.today}`);
console.log(`   This Week: ${stats.thisWeek}`);
```

```bash
node upload-stats.js
```

---

## 💡 Pro Tips

### Combine Commands

```bash
# Scrape, convert, and review in one go
npm run scrape && npm run convert && npm run manual-upload
```

### Use Watch Mode

```bash
# Auto-convert when scraped data changes
npx nodemon --watch scraped-unique.json --exec "npm run convert"
```

### Schedule with Cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add line (run daily at 9 AM)
0 9 * * * cd /path/to/COVERTER && npm run full-pipeline
```

---

## 🎉 Common Workflows

### Workflow A: Maximum Control
```bash
1. npm run scrape              # Scrape
2. Review scraped-unique.json  # Check data
3. npm run convert             # Convert
4. Review output.json          # Check conversion
5. npm run manual-upload       # Upload with approval
```

### Workflow B: Balanced
```bash
1. npm run full-pipeline       # Auto scrape + convert
2. npm run manual-upload       # Manual review
```

### Workflow C: Fully Automated
```bash
1. Set AUTO_UPLOAD=true in .env
2. npm run full-pipeline       # Everything automatic
```

---

**Choose the workflow that fits your needs! 🚀**

