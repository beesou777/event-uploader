# 🚀 Quick Start Guide

Get up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

Or if you use yarn:

```bash
yarn install
```

## Step 2: Configure Your API

The `.env` file is already set up with your credentials. If you need to change them:

```bash
# Edit .env file
ACCESS_TOKEN=your_token_here
```

## Step 3: Run the Pipeline

### Option A: Full Automation (Recommended for First Run)

```bash
npm run full-pipeline
```

This will:
- ✅ Scrape events from multiple Norwegian tech event sites
- ✅ Remove duplicates intelligently
- ✅ Convert to your database schema with AI enhancement
- ✅ Save to `output.json` for review

**Note**: By default, it won't auto-upload. You need to review first!

## Step 4: Review & Upload

### Option B: Manual Upload (Recommended)

```bash
npm run manual-upload
```

This opens an interactive interface where you can:
- 👀 Review each event with full details
- ✅ Approve events individually
- ⏭️ Skip events you don't want
- 📤 Upload all remaining at once
- 🛑 Quit anytime

Example interaction:
```
╔════════════════════════════════════════════════════════════╗
║  Event 1/25                                               ║
╠════════════════════════════════════════════════════════════╣
║  Name: AI & Machine Learning Meetup Oslo                  ║
╠════════════════════════════════════════════════════════════╣
  📂 Categories: Tech & AI, Networking & Community
  📍 Location: Oslo, Norway
  📅 Start: 2024-12-01 18:00
  🎫 Ticket: FREE
  
📋 Options:
   [Y] Upload this event
   [N] Skip this event
   [A] Upload All remaining
   [Q] Quit

Your choice: y
```

### Option C: Automatic Upload (Advanced)

If you're confident and want full automation:

```bash
# Edit .env
AUTO_UPLOAD=true

# Run pipeline
npm run full-pipeline
```

## What Gets Created?

After running, you'll have these files:

- `scraped-raw.json` - All scraped events (before deduplication)
- `scraped-unique.json` - After removing duplicates
- `output.json` - Final converted events (ready to upload)
- `uploaded-log.json` - History of what's been uploaded

## 📊 Expected Results

On first run, you should see:
- 50-200 events scraped (varies by availability)
- 10-30% duplicate removal rate
- 100% conversion success rate
- Events categorized into your 5 main categories:
  1. Tech & AI
  2. Business & Leadership
  3. Career & Learning
  4. Networking & Community
  5. Innovation & Future

## 🔄 Daily Usage

After first setup, run daily:

```bash
# This will only process NEW events
npm run full-pipeline

# Then review and upload
npm run manual-upload
```

The system remembers what's been uploaded and won't create duplicates!

## 🎯 Target Event Sources

The scraper automatically checks:

1. **Eventbrite Norway** - Oslo, Bergen, Trondheim tech events
2. **Meetup.com** - Tech groups in Norway
3. **Finn.no** - Norwegian event listings
4. **Tech Communities** - Oslo Tech Events, TechBBQ
5. **Event Aggregators** - AllEvents, 10times

## 💡 Pro Tips

1. **First run?** Start with manual upload to see what's being scraped
2. **Too many events?** Reduce `MAX_EVENTS_PER_RUN` in `.env`
3. **Missing events?** Check `scraped-raw.json` to see what was found
4. **Wrong categories?** Edit the keywords in `ai-converter.js`
5. **Need more sources?** Add scrapers in `scraper.js`

## 🐛 Common Issues

### "No events found"
- Normal on weekends/holidays
- Try again on weekdays
- Some sites may have rate limiting

### "Upload failed"
- Check if ACCESS_TOKEN is valid
- Verify API_URL is correct
- Check internet connection

### "All events already exist"
- Good! System is working
- Delete `uploaded-log.json` to re-upload
- Delete `output.json` to force re-scrape

## ⚡ Super Quick Test

Want to test without waiting for scraping?

```bash
# Skip to manual upload (if output.json exists)
npm run manual-upload
```

## 📞 Need Help?

Check the full `README.md` for:
- Detailed configuration options
- Troubleshooting guide
- Advanced features
- API documentation

## 🎉 You're Ready!

That's it! Your automated tech event scraper for Norway is ready to go.

Run `npm run full-pipeline` and watch the magic happen! ✨

