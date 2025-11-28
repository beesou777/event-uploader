# AI Integration Guide

## Overview

The event scraper now supports AI-powered data transformation using OpenAI or Anthropic models. This enhances feature extraction and ensures better data quality.

## 💰 Pricing Information

### ✅ **Hugging Face - 100% FREE!** (Recommended)
- **FREE tier available** - No API key required for basic usage
- **Free models**: Llama-3.2-3B, Phi-3-mini, Mistral-7B, etc.
- **No costs** - Perfect for event scraping!
- **Default option** - Just set `AI_PROVIDER=huggingface`

### 💵 Paid Options (Optional)
- **OpenAI gpt-4o-mini**: ~$0.001-0.01 per event
- **Anthropic Claude Haiku**: ~$0.001-0.01 per event

### 📝 Free NLP Fallback
- Uses free NLP (Compromise.js) if no AI provider is set
- No API costs - works out of the box
- AI only enhances feature extraction (not required)

## Configuration

### ✅ Option 1: Hugging Face (FREE - Recommended!)
```env
# Use FREE Hugging Face models (no API key needed!)
AI_PROVIDER=huggingface
HUGGINGFACE_MODEL=meta-llama/Llama-3.2-3B-Instruct  # Free model

# Optional: Get free API key from https://huggingface.co/settings/tokens
# (Increases rate limits, but works without it too)
HUGGINGFACE_API_KEY=your_free_token_here

# Minimum days from today for events (default: 2)
MIN_DAYS_FROM_TODAY=2
```

### 💵 Option 2: Paid AI Providers (Optional)
```env
# OpenAI (paid)
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# OR Anthropic (paid)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

### 📝 Option 3: No AI (Free NLP - Default)
Just don't set any AI_PROVIDER - uses free Compromise.js NLP automatically!

**💡 Recommendation**: Use Hugging Face (FREE) for best results with zero costs!

## Features

### 1. AI-Powered Feature Extraction
- Uses AI models to extract unique, specific event features
- Prevents duplicate features and title repetition
- Falls back to NLP if AI is unavailable

### 2. Date Filtering
- Events must be at least 2-3 days from today (configurable)
- Prevents uploading past or too-soon events
- Configurable via `MIN_DAYS_FROM_TODAY` environment variable

### 3. Enhanced Data Quality
- **Fixed duplicate title/description issue**: Descriptions are now unique and different from titles
- **Redirect URL validation**: Ensures `externalRedirectUrl` is always present
- **Better feature extraction**: AI generates more relevant, unique features

## Workflow

1. **Scrape** → Data saved to `scraped-raw.json`
2. **Deduplicate** → Unique events saved to `scraped-unique.json`
3. **AI Transform** → Events converted with AI enhancement → `output.json`
4. **Upload** → Events uploaded and logged to `uploader-event.json`

## Log File Change

The upload log file has been renamed from `uploaded-log.json` to `uploader-event.json` for consistency.

## Usage

### ✅ With Hugging Face (FREE - Recommended!)
```bash
# Add to .env
echo "AI_PROVIDER=huggingface" >> .env

# Run pipeline
npm run full-pipeline
```
**Cost**: $0.00 - Completely FREE! 🎉

### 📝 Without AI (Free NLP - Default)
**Just run the pipeline - no configuration needed!**
```bash
npm run full-pipeline
```
Uses free Compromise.js NLP automatically.

### 💵 With Paid AI (Optional)
```bash
# Set paid API keys in .env
export OPENAI_API_KEY=your_key
# or
export ANTHROPIC_API_KEY=your_key

# Run pipeline
npm run full-pipeline
```
**Cost estimate**: ~$0.001-0.01 per event

## Benefits

- **100% Free by Default**: Works without any API keys using NLP
- **Better Features** (with AI): AI extracts more relevant, unique features
- **No Duplicates**: Prevents title/description duplication (works with or without AI)
- **Date Filtering**: Only future events (2+ days away)
- **URL Validation**: Ensures redirect URLs are always present
- **Flexible**: Works perfectly with or without AI (graceful fallback)

## Summary

✅ **Hugging Face is FREE** - Use `AI_PROVIDER=huggingface` for free AI features!
✅ **All fixes work** (date filtering, URL validation, duplicate prevention) - no AI needed
✅ **Free by default** - Uses NLP if no AI provider is set
✅ **Zero costs** with Hugging Face or NLP fallback

## Popular Free Hugging Face Models

You can use any of these free models (just change `HUGGINGFACE_MODEL` in `.env`):

- `meta-llama/Llama-3.2-3B-Instruct` (default - best for JSON)
- `microsoft/Phi-3-mini-4k-instruct` (fast & efficient)
- `mistralai/Mistral-7B-Instruct-v0.2` (high quality)
- `google/flan-t5-base` (lightweight)

**Get free API token**: https://huggingface.co/settings/tokens (optional but recommended for higher rate limits)

