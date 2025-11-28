# 🔧 Duplicate Upload Fix

## Problem
When running the scraper multiple times, the same events were being uploaded again, creating duplicates in your database.

## Root Cause
1. The pipeline was **replacing** `output.json` entirely with newly scraped events
2. It wasn't checking against `uploaded-log.json` before adding events to `output.json`
3. Even if events were already uploaded, they would appear in `output.json` again

## Solution Implemented

### 1. **Filter Already-Uploaded Events**
   - After converting events, the pipeline now checks `uploaded-log.json`
   - Events that are already uploaded are **filtered out** before being added to `output.json`
   - Uses improved URL matching (normalizes URLs to ignore query parameters)

### 2. **Merge with Existing Events**
   - Instead of replacing `output.json`, the pipeline now:
     - Loads existing events from `output.json`
     - Merges them with newly scraped events
     - Removes duplicates
     - Only keeps events that haven't been uploaded yet

### 3. **Improved URL Matching**
   - Added `normalizeUrl()` function that:
     - Removes query parameters (like `?aff=ebdssbdestsearch`)
     - Removes trailing slashes
     - Normalizes for case-insensitive comparison
   - This ensures events with the same URL (even with different query params) are recognized as duplicates

### 4. **Better Upload Detection**
   - Primary check: URL match (most reliable)
   - Secondary check: Name + URL similarity
   - Works in both `pipeline.js` and `manual-upload.js`

## How It Works Now

### Before (Old Behavior):
```
1. Scrape events → 16 events
2. Remove duplicates → 9 events
3. Convert → 9 events
4. REPLACE output.json → 9 events (even if already uploaded!)
5. Upload → Uploads all 9 again (duplicates!)
```

### After (New Behavior):
```
1. Scrape events → 16 events
2. Remove duplicates → 9 events
3. Convert → 9 events
4. Check uploaded-log.json → 9 already uploaded
5. Filter out uploaded → 0 new events
6. Merge with existing output.json → Only non-uploaded events
7. Save to output.json → 0 events (nothing to upload!)
```

## What Changed in the Code

### `pipeline.js`
- Added `normalizeUrl()` function
- Added `isEventUploaded()` function
- Modified Step 3 to filter already-uploaded events
- Modified Step 3 to merge with existing `output.json`
- Updated summary to show filtered events

### `manual-upload.js`
- Added `normalizeUrl()` function
- Added `isEventUploaded()` function
- Uses improved matching when filtering pending events

## Testing

To verify the fix works:

1. **Run pipeline with already-uploaded events:**
   ```bash
   npm run full-pipeline
   ```
   
   You should see:
   ```
   🔍 Checking against 9 already-uploaded events...
   ⏭️  Filtered out 9 already-uploaded events
   ✅ Total events ready to upload: 0
   ```

2. **Check output.json:**
   - Should only contain events that haven't been uploaded yet
   - Already-uploaded events won't appear

3. **Run manual upload:**
   ```bash
   npm run manual-upload
   ```
   
   Should show:
   ```
   🎉 All events have been uploaded!
   Total: 9 events
   Uploaded: 9 events
   ```

## Benefits

✅ **No More Duplicates**: Already-uploaded events are automatically excluded  
✅ **Smart Merging**: Existing events in `output.json` are preserved  
✅ **Better URL Matching**: Handles URL variations (query params, trailing slashes)  
✅ **Clear Feedback**: Shows how many events were filtered out  
✅ **Works for Both Modes**: Automatic and manual upload both use the same logic  

## Daily Workflow (Now Safe!)

You can now safely run the pipeline daily:

```bash
# Run daily - won't create duplicates!
npm run full-pipeline

# Review and upload only NEW events
npm run manual-upload
```

The system will:
- ✅ Scrape fresh events
- ✅ Filter out already-uploaded ones
- ✅ Only show you NEW events to upload
- ✅ Never upload the same event twice

## Troubleshooting

### If you still see duplicates:

1. **Check uploaded-log.json:**
   - Make sure it contains all uploaded events
   - Each entry should have `name` and `externalRedirectUrl`

2. **Check URL format:**
   - Events with different URLs (even slightly) won't be detected as duplicates
   - The URL normalization helps, but exact matches work best

3. **Manual cleanup:**
   - If you need to re-upload an event, remove it from `uploaded-log.json`
   - Or delete `uploaded-log.json` to reset (but you'll lose upload history)

### To reset and start fresh:

```bash
# Delete upload log (WARNING: You'll lose upload history!)
Remove-Item uploaded-log.json

# Delete output.json to force fresh scrape
Remove-Item output.json
```

---

**The duplicate upload problem is now fixed! 🎉**

