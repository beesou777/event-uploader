# 🚀 Step-by-Step Guide - Norway Tech Events Scraper

## ⚠️ IMPORTANT: Fix Required First!

Your `scraped-raw.json` file is empty, which is causing the pipeline to fail. Let's fix this first!

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- ✅ Node.js installed (check with: `node --version`)
- ✅ npm installed (check with: `npm --version`)
- ✅ Dependencies installed (run: `npm install`)
- ✅ `.env` file with your API credentials

---

## 🔧 Step 1: Fix the Empty JSON Files

The pipeline is failing because `scraped-raw.json` is empty. Delete it to force a fresh scrape:

**On Windows PowerShell:**
```powershell
cd "C:\Users\bishwa shah\OneDrive\Desktop\COVERTER"
Remove-Item scraped-raw.json -ErrorAction SilentlyContinue
Remove-Item scraped-unique.json -ErrorAction SilentlyContinue
Remove-Item output.json -ErrorAction SilentlyContinue
```

**Or manually delete these files:**
- `scraped-raw.json`
- `scraped-unique.json`
- `output.json`

---

## 🔑 Step 2: Verify Your .env File

Make sure your `.env` file exists and has the correct format:

```env
API_URL=https://eventeir.roshankarki1.com.np/api/v1/events/create/v2
ACCESS_TOKEN=your_token_here
AUTO_UPLOAD=false
```

**To check if your .env file is correct:**
```powershell
Get-Content .env
```

**Note:** The token in `pipeline.js` might be expired. Update it in `.env` if needed.

---

## 📦 Step 3: Install Dependencies (If Not Done)

```powershell
cd "C:\Users\bishwa shah\OneDrive\Desktop\COVERTER"
npm install
```

You should see all packages installed. If you see errors, fix them first.

---

## 🎯 Step 4: Run the Pipeline

### Option A: Full Pipeline (Recommended for First Run)

This will scrape, deduplicate, and convert events:

```powershell
npm run full-pipeline
```

**What happens:**
1. ✅ Scrapes events from multiple Norwegian tech event sources
2. ✅ Removes duplicates (85% similarity threshold)
3. ✅ Converts to your database schema with AI enhancement
4. ✅ Saves to `output.json` for review

**Expected output:**
```
╔════════════════════════════════════════════════════════════╗
║  🚀 NORWAY TECH EVENTS - AUTOMATED PIPELINE              ║
║  Scrape → Deduplicate → Convert → Upload                 ║
╚════════════════════════════════════════════════════════════╝

📍 STEP 1: SCRAPING EVENTS FROM MULTIPLE SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Loaded X scraped events

📍 STEP 2: DUPLICATE DETECTION & REMOVAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ X unique events ready for conversion

📍 STEP 3: CONVERTING TO EVENT SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Total events in database: X

📍 STEP 4: UPLOADING TO PLATFORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  AUTO_UPLOAD is disabled. Set AUTO_UPLOAD=true in environment to enable automatic upload.
```

**Time:** This takes 30-60 seconds depending on how many events are found.

---

## 👀 Step 5: Review the Results

After the pipeline runs, check the generated files:

### Check `output.json`
```powershell
# View first few events
Get-Content output.json | Select-Object -First 50
```

Or open `output.json` in a text editor to see all converted events.

### Check `scraped-raw.json`
This contains all raw scraped events before processing.

### Check `scraped-unique.json`
This contains events after duplicate removal.

---

## 📤 Step 6: Upload Events

### Option A: Manual Upload (Recommended - Review Each Event)

This lets you review and approve each event before uploading:

```powershell
npm run manual-upload
```

**Interactive interface:**
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

**Commands:**
- `Y` or `y` - Upload this event
- `N` or `n` - Skip this event
- `A` or `a` - Upload all remaining events
- `Q` or `q` - Quit without uploading

### Option B: Automatic Upload (Advanced)

If you're confident and want full automation:

1. **Edit `.env` file:**
   ```env
   AUTO_UPLOAD=true
   ```

2. **Run pipeline again:**
   ```powershell
   npm run full-pipeline
   ```

This will automatically upload all events without asking.

---

## 🔄 Daily Workflow

Once everything is set up, your daily workflow is:

```powershell
# 1. Delete old scraped data (optional - to force fresh scrape)
Remove-Item scraped-raw.json -ErrorAction SilentlyContinue

# 2. Run full pipeline
npm run full-pipeline

# 3. Review and upload manually
npm run manual-upload
```

---

## 🐛 Troubleshooting

### Error: "Unexpected end of JSON input"
**Solution:** Delete the empty JSON files:
```powershell
Remove-Item scraped-raw.json, scraped-unique.json, output.json -ErrorAction SilentlyContinue
```

### Error: "401 Unauthorized" or "Access token expired"
**Solution:** Update your `ACCESS_TOKEN` in `.env` file with a fresh token.

### Error: "No events found"
**Possible causes:**
- Normal on weekends/holidays when fewer events are posted
- Some sites may have rate limiting
- Internet connection issues

**Solution:** Try again later or check your internet connection.

### Error: "Module not found"
**Solution:** Reinstall dependencies:
```powershell
npm install
```

### Pipeline runs but no events scraped
**Check:**
1. Internet connection is working
2. Event sources are accessible
3. Try running individual scrapers in `scraper.js`

### Upload fails with validation errors
**Common issues:**
- Missing required fields (description, features, coordinates)
- Invalid image URLs
- Token expired

**Solution:** Check the error message and fix the specific field mentioned.

---

## 📊 Understanding the Output Files

| File | Purpose | When to Check |
|------|---------|---------------|
| `scraped-raw.json` | All scraped events (before processing) | To see what was found |
| `scraped-unique.json` | After duplicate removal | To verify deduplication worked |
| `output.json` | Final converted events (ready to upload) | **Review this before uploading** |
| `uploaded-log.json` | History of uploaded events | To track what's been uploaded |

---

## 🎯 Quick Test Run

Want to test without waiting for scraping?

```powershell
# If output.json already exists with events
npm run manual-upload
```

This will let you review and upload existing events without re-scraping.

---

## 📝 Individual Commands

You can also run each step separately:

```powershell
# 1. Scrape only
npm run scrape

# 2. Convert only (requires scraped-unique.json)
npm run convert

# 3. Upload only (requires output.json)
npm run upload
```

---

## ✅ Success Checklist

After running the pipeline, you should have:

- ✅ `scraped-raw.json` with events (not empty)
- ✅ `scraped-unique.json` with deduplicated events
- ✅ `output.json` with converted events ready to upload
- ✅ No errors in the console
- ✅ Events categorized into 5 main categories

---

## 🆘 Still Not Working?

If you're still having issues:

1. **Check the error message** - It usually tells you what's wrong
2. **Verify .env file** - Make sure ACCESS_TOKEN is valid
3. **Check internet connection** - Scraping requires internet
4. **Delete all JSON files** - Start fresh:
   ```powershell
   Remove-Item *.json -Exclude package*.json -ErrorAction SilentlyContinue
   ```
5. **Reinstall dependencies:**
   ```powershell
   Remove-Item node_modules -Recurse -Force
   npm install
   ```

---

## 🎉 You're Ready!

Follow these steps in order, and your Norway tech events scraper should work perfectly!

**Remember:**
- Always delete empty JSON files before running
- Review `output.json` before uploading
- Use manual upload for first-time review
- Set `AUTO_UPLOAD=true` only when confident

Good luck! 🚀

