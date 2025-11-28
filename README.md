# 🇳🇴 Norway Tech Events - Automated Scraper & Uploader

A powerful automated system to scrape, convert, and upload tech events from multiple sources in Norway. Built specifically for discovering and sharing tech events across 5 main categories.

## 🎯 Features

- **Multi-Source Scraping**: Scrapes events from Eventbrite, Meetup, Finn.no, and tech communities
- **AI-Powered Conversion**: Uses NLP to extract features and social media links
- **Smart Duplicate Detection**: 85% similarity threshold with intelligent merging
- **Category Matching**: Automatically categorizes events into 5 main tech categories
- **External Redirect URLs**: All events redirect to original sources
- **Manual Review**: Interactive interface to review before uploading
- **Automatic Upload**: Option for fully automated pipeline

## 📂 Categories

The system focuses on 5 main tech event categories:

1. **Tech & AI** - AI, Machine Learning, Software Development, Cloud, Cybersecurity
2. **Business & Leadership** - Management, Strategy, Product Management, Growth
3. **Career & Learning** - Training, Workshops, Bootcamps, Career Development
4. **Networking & Community** - Meetups, Hackathons, Tech Communities
5. **Innovation & Future** - Startups, Research, Emerging Tech, Sustainability

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install
# or
yarn install
```

### Configuration

1. Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

2. Edit `.env` with your credentials:

```env
API_URL=https://eventeir.roshankarki1.com.np/api/v1/events/create/v2
ACCESS_TOKEN=your_token_here
AUTO_UPLOAD=false
```

### Usage

#### 🔄 Full Automated Pipeline

Run the complete pipeline (scrape → deduplicate → convert):

```bash
npm run full-pipeline
```

This will:
1. Scrape events from multiple sources
2. Remove duplicates
3. Convert to your schema with AI enhancement
4. Save to `output.json`

#### 📤 Manual Upload (Recommended)

Review and approve events before uploading:

```bash
npm run manual-upload
```

Features:
- Interactive review of each event
- See all details before uploading
- Upload individually or all at once
- Skip unwanted events
- Real-time upload status

#### 🤖 Automatic Upload

For fully automated operation:

```bash
# Set in .env
AUTO_UPLOAD=true

# Then run
npm run full-pipeline
```

#### 🔍 Individual Steps

Run specific parts of the pipeline:

```bash
# 1. Scrape only
npm run scrape

# 2. Convert only (requires scraped-unique.json)
npm run convert

# 3. Upload only (requires output.json)
npm run upload
```

## 📁 File Structure

```
COVERTER/
├── scraper.js              # Multi-source web scraper
├── duplicate-detector.js   # Smart duplicate detection
├── ai-converter.js         # AI-powered converter
├── pipeline.js             # Full automated pipeline
├── manual-upload.js        # Interactive upload interface
├── upload.js              # Automated upload (legacy)
├── convert.js             # Original converter (legacy)
├── package.json           # Dependencies & scripts
├── .env                   # Configuration (create this)
│
├── scraped-raw.json       # Raw scraped data
├── scraped-unique.json    # After duplicate removal
├── output.json            # Converted events (ready to upload)
└── uploaded-log.json      # Upload history
```

## 🛠️ How It Works

### 1. Scraping (`scraper.js`)

Scrapes from multiple sources:
- **Eventbrite Norway**: Tech events in Oslo, Bergen, Trondheim
- **Meetup.com**: Tech, AI, startup, developer groups
- **Finn.no**: Norwegian event listings
- **Tech Communities**: Oslo Tech Events, TechBBQ
- **Generic Aggregators**: AllEvents, 10times

### 2. Duplicate Detection (`duplicate-detector.js`)

Intelligent duplicate detection using:
- Name similarity (50% weight)
- URL matching (100% weight if exact)
- Date proximity (20% weight)
- Location matching (15% weight)

Merges duplicates by keeping the most complete event.

### 3. AI Conversion (`ai-converter.js`)

Converts scraped data to your schema:
- **NLP Feature Extraction**: Uses Compromise.js to extract key features
- **Social Media Detection**: Finds Facebook, Twitter, LinkedIn, Instagram
- **Smart Category Matching**: Keywords-based categorization
- **Date Parsing**: Handles multiple date formats
- **Price Extraction**: Detects free vs paid events

### 4. Upload (`pipeline.js` / `manual-upload.js`)

Two upload modes:
- **Manual**: Review each event interactively
- **Automatic**: Batch upload with rate limiting

## 📊 Event Schema

Each event is converted to this structure:

```javascript
{
  name: "Event Name",
  slug: "event-name",
  description: "Full description",
  additionalInfo: "",
  theme: "",
  capacity: 100,
  lang: "en",
  
  startDate: "2024-01-01T10:00:00Z",
  endDate: "2024-01-01T18:00:00Z",
  
  venue: "Venue Name",
  city: "Oslo",
  state: "",
  country: "Norway",
  address1: "Street Address",
  address2: "",
  longitude: 10.7522,
  latitude: 59.9139,
  
  isPhysical: true,
  platform: "Eventbrite",
  
  socialMedias: {
    facebook: "https://facebook.com/...",
    twitter: "https://twitter.com/...",
    linkedin: "https://linkedin.com/...",
    instagram: "https://instagram.com/..."
  },
  
  categoryIds: [1, 2, 3],
  images: ["https://..."],
  faqs: [],
  audience: [],
  features: ["Feature 1", "Feature 2"],
  
  tickets: [{
    name: "General Admission",
    description: "",
    price: 0,
    maximumTicketCapacity: 100,
    currency: "NOK",
    isFree: true,
    hasAvailableTickets: true,
    isSoldOut: false
  }],
  
  refundPolicy: "...",
  externalRedirectUrl: "https://original-event-url.com"
}
```

## 🎨 Features

### ✨ AI-Powered Feature Extraction

The system automatically extracts event features using NLP:
- Key topics and subjects
- Learning outcomes ("learn", "gain", "discover")
- Attendee benefits
- Filtered to 3-5 high-quality features

### 🔗 Social Media Auto-Detection

Automatically finds and extracts:
- Facebook pages and profiles
- Twitter/X handles
- LinkedIn companies and profiles
- Instagram accounts

### 🚫 Duplicate Prevention

Multiple layers of duplicate detection:
1. Within scraped batch (similarity-based)
2. Against existing events (cross-check with output.json)
3. Upload history (uploaded-log.json)

### 📍 Location Intelligence

Smart location handling:
- Extracts city, venue, address
- Detects online vs physical events
- Parses coordinates when available

## 🔧 Advanced Configuration

### Customize Categories

Edit `ai-converter.js` to modify the 5 main categories:

```javascript
const MAIN_CATEGORIES = [
  {
    id: 1,
    name: 'Your Category',
    keywords: ['keyword1', 'keyword2']
  }
];
```

### Add More Scrapers

Add new sources in `scraper.js`:

```javascript
async function scrapeYourSource() {
  // Your scraping logic
  return events;
}

// Add to main scraper
const scrapers = [
  // ... existing scrapers
  scrapeYourSource()
];
```

### Adjust Duplicate Threshold

In `duplicate-detector.js`:

```javascript
const SIMILARITY_THRESHOLD = 0.85; // 0.0 to 1.0
const DATE_THRESHOLD_DAYS = 1;     // Days difference
```

### Rate Limiting

In `pipeline.js`:

```javascript
const CONFIG = {
  MAX_EVENTS_PER_RUN: 50,  // Max events per run
};

// Adjust wait time between uploads (milliseconds)
await new Promise(resolve => setTimeout(resolve, 2000));
```

## 📈 Best Practices

1. **Start with Manual Review**: Use `npm run manual-upload` for first run
2. **Check Duplicates**: Review `scraped-unique.json` after deduplication
3. **Verify Categories**: Check if events are categorized correctly
4. **Test Small Batches**: Start with a few events before full automation
5. **Monitor Logs**: Keep `uploaded-log.json` for tracking
6. **Update Regularly**: Run daily/weekly for fresh events

## 🐛 Troubleshooting

### No events scraped
- Check internet connection
- Some sites may block scrapers (rate limiting)
- Try running individual scrapers

### Upload fails
- Verify ACCESS_TOKEN in .env
- Check API_URL is correct
- Ensure token hasn't expired
- Check image URLs are accessible

### Too many duplicates
- Adjust SIMILARITY_THRESHOLD lower (e.g., 0.75)
- Check if scrapers are pulling same sources

### Missing features/social media
- Events with short descriptions may have fewer features
- Social media extraction depends on text quality
- Manually add to output.json if needed

## 🔐 Security

- Never commit `.env` file
- Keep `ACCESS_TOKEN` secure
- Rotate tokens regularly
- Don't share `uploaded-log.json` (may contain sensitive data)

## 📝 License

ISC

## 🤝 Contributing

This is a personal project, but feel free to:
1. Fork the repository
2. Add new scrapers for Norwegian sites
3. Improve category matching
4. Enhance AI features

## 💡 Tips

- **Scheduling**: Use cron or Windows Task Scheduler for automatic runs
- **Monitoring**: Set up alerts for failed uploads
- **Backup**: Keep backups of `output.json` and `uploaded-log.json`
- **Testing**: Use a test API endpoint first
- **Performance**: Scrapers run in parallel for speed

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the logs in console output
3. Check individual JSON files for data quality

---

**Built for tech event organizers in Norway 🇳🇴**

*Automate your event discovery and publishing workflow!*

