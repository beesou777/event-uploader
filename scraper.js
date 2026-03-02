import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import { format, parseISO, addDays } from 'date-fns';
import puppeteer from 'puppeteer';
import { checkIfEventExists, closePool } from './db-utils.js';

// ==================== SCRAPER CONFIGURATION ====================
const NORWAY_LOCATIONS = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Norway', 'Norge', 'Drammen', 'Kristiansand', 'Sandnes', 'Tromsø'];
const TECH_KEYWORDS = [
  'tech', 'technology', 'AI', 'artificial intelligence', 'machine learning', 
  'software', 'programming', 'coding', 'developer', 'data science',
  'blockchain', 'cybersecurity', 'cloud', 'devops', 'agile', 'scrum',
  'web development', 'frontend', 'backend', 'fullstack', 'mobile app',
  'fintech', 'saas', 'api', 'microservices', 'big data', 'python',
  'javascript', 'react', 'node.js', 'typescript', 'aws', 'azure', 'docker',
  'kubernetes', 'iot', 'robotics', 'automation', 'it-sikkerhet', 'it-utvikling',
  'kunstig intelligens', 'maskinlæring', 'dataanalyse', 'skyen', 'backendutvikling',
  'frontendutvikling', 'fullstackutvikling', 'programvareutvikling', 'systemutvikling',
  'produktutvikling', 'design thinking', 'ux-design', 'digital transformasjon'
];

const EXCLUDED_KEYWORDS = [
  'party', 'concert', 'dance', 'speed dating', 'yoga', 'coloring',
  'barnefilm', 'teater', 'kids', 'barn', 'family', 'dating',
  'meditation', 'breathwork', 'sports', 'football', 'quiz',
  'film', 'movie', 'exhibition', 'art', 'music', 'dj', 'night',
  'vinfestival', 'wine', 'beer', 'stand-up', 'comedy'
];

// ==================== HELPER: EXTRACT TITLE FROM URL ====================
function extractTitleFromEventbriteUrl(url) {
  try {
    // Eventbrite URLs format: /e/event-name-slug-tickets-123456
    const match = url.match(/\/e\/([^\/\?]+)/);
    if (match) {
      let slug = match[1];
      // Remove "-tickets-123456" suffix
      slug = slug.replace(/-tickets-\d+.*$/, '');
      // Convert slug to title (capitalize words)
      const title = slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return title;
    }
  } catch (err) {
    // Silent fail
  }
  return null;
}

// ==================== HELPER: FILTER GENERIC STATUS MESSAGES ====================
function isGenericStatusMessage(text) {
  if (!text) return true;
  const genericMessages = [
    'sales end soon',
    'just added',
    'going fast',
    'almost full',
    'sold out',
    'sales ended',
    'privacy policy',
    'terms & conditions',
    'code of conduct',
    'register now',
    'book now',
    'buy tickets'
  ];
  const normalized = text.toLowerCase().trim();
  return genericMessages.some(msg => normalized === msg || normalized.startsWith(msg + ' '));
}

// ==================== HELPER: EXTRACT REAL TITLE ====================
function extractRealTitle(name, dateText, url) {
  // If name is a generic status message, try alternatives
  if (isGenericStatusMessage(name)) {
    // Try dateText - often contains the real title
    if (dateText && !isGenericStatusMessage(dateText) && dateText.length > 10) {
      // Check if dateText looks like a title (not a date)
      if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(dateText) &&
          !/^\d{1,2}[\/\-]\d{1,2}/.test(dateText)) {
        return dateText;
      }
    }
    
    // Try extracting from URL
    const urlTitle = extractTitleFromEventbriteUrl(url);
    if (urlTitle && !isGenericStatusMessage(urlTitle) && urlTitle.length > 5) {
      return urlTitle;
    }
  }
  
  // Return original name if it's not generic
  return name;
}

// ==================== EVENTBRITE SCRAPER (ENHANCED) ====================
async function scrapeEventbrite() {
  console.log('🔍 Scraping Eventbrite Norway Tech Events...');
  const events = [];
  
  // Scrape multiple pages to get more events
  const maxPages = 10;
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      // Use search query for more coverage
      const url = `https://www.eventbrite.com/d/norway/all-events/?q=tech+technology+coding&page=${page}`;
      console.log(`   📄 Scraping Eventbrite Page ${page}...`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      
      // Multiple selector patterns to catch different page layouts
      const selectors = [
        '.discover-search-desktop-card',
        '[data-testid="event-card"]',
        '.event-card',
        '.search-event-card-wrapper',
        'article[class*="event"]',
        '[class*="EventCard"]',
        '.eds-event-card',
        '[data-automation="event-card"]'
      ];
      
      let pageCount = 0;
      for (const selector of selectors) {
        $(selector).each((i, el) => {
          try {
            const $el = $(el);
            
            // Try multiple ways to extract name
            let name = $el.find('.Typography_root__487rx').first().text().trim() ||
                        $el.find('h2, h3, h4').first().text().trim() ||
                        $el.find('[class*="title"], [class*="name"]').first().text().trim() ||
                        $el.attr('aria-label') || '';
            
            // Try multiple ways to extract link
            const link = $el.find('a').first().attr('href') ||
                        $el.attr('href') ||
                        $el.find('[href*="/e/"]').attr('href') || '';
            
            // Try multiple ways to extract date (be more specific)
            const dateText = $el.find('p[class*="event-card-details"], p[class*="event-card-info"], .Typography_root__487rx').filter((i, p) => {
              const pText = $(p).text().trim();
              // Check if it's a date-like text (contains day or month names)
              return /(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(pText);
            }).first().text().trim() ||
                           $el.find('time').attr('datetime') ||
                           $el.find('time').text().trim() ||
                           $el.find('[class*="date"]').first().text().trim() || '';
            
            // Try multiple ways to extract price
            const priceText = $el.find('.eds-text-bs--fixed').text().trim() ||
                            $el.find('[class*="price"]').text().trim() || '';
            
            // Try multiple ways to extract image
            const image = $el.find('img').first().attr('src') ||
                        $el.find('img').first().attr('data-src') ||
                        $el.find('[class*="image"] img').attr('src') || '';
            
            if (name && link && name.length > 5) {
              const fullUrl = link.startsWith('http') ? link : `https://www.eventbrite.com${link}`;
              
              // Extract real title (filter out generic status messages)
              const realTitle = extractRealTitle(name, dateText, fullUrl);
              
              // Skip if we couldn't find a real title
              if (!realTitle || isGenericStatusMessage(realTitle) || realTitle.length < 5) {
                return; // Skip this event
              }
              
              // Avoid duplicates
              if (!events.some(e => e.url === fullUrl)) {
                events.push({
                  source: 'eventbrite',
                  name: realTitle, // Use the real title, not generic status
                  url: fullUrl,
                  dateText: dateText,
                  priceText: priceText,
                  image: image,
                  location: 'Norway',
                  country: 'Norway',
                  category: 'technology'
                });
                pageCount++;
              }
            }
          } catch (err) {
            // Silent fail for individual event parsing
          }
        });
      }
      
      // If we found no new events on this page, stop early
      if (pageCount === 0 && page > 1) break;
      
    } catch (error) {
      console.error(`   ❌ Error on Eventbrite Page ${page}:`, error.message);
      break; // Stop pagination on major error
    }
  }
  
  console.log(`  Found ${events.length} events from Eventbrite`);
  return events;
}

// ==================== MEETUP.COM SCRAPER (Using Puppeteer for JS-rendered content) ====================
async function scrapeMeetup() {
  console.log('🔍 Scraping Meetup.com Norway Tech Events...');
  const events = [];
  let browser = null;
  
  try {
    // Meetup uses JavaScript rendering, so we need Puppeteer
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Tech Category ID: 546
    const urls = [
      'https://www.meetup.com/find/?source=EVENTS&location=no--oslo&categoryId=546&eventType=all',
      'https://www.meetup.com/find/?source=EVENTS&location=no--bergen&categoryId=546&eventType=all',
      'https://www.meetup.com/find/?source=EVENTS&location=no--trondheim&categoryId=546&eventType=all',
      'https://www.meetup.com/find/?source=EVENTS&location=no--stavanger&categoryId=546&eventType=all'
    ];
    
    for (const url of urls) {
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`   🏙️  Scraping Meetup for ${url.split('location=no--')[1].split('&')[0]}...`);
        
        // Scroll down multiple times to load more events
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // Wait for event cards to appear
        try {
          await page.waitForSelector('[data-testid="categoryResults-eventCard"]', { timeout: 10000 });
        } catch (e) {
          // If selector not found, might already be loaded
        }
        
        // Extract events from the page using the actual HTML structure
        const pageEvents = await page.evaluate(() => {
          const results = [];
          
          // Use the actual selector from the HTML: data-testid="categoryResults-eventCard"
          const eventCards = document.querySelectorAll('[data-testid="categoryResults-eventCard"]');
          
          eventCards.forEach(card => {
            try {
              // Find the link
              const link = card.querySelector('a[href*="/events/"]');
              if (!link) return;
              
              const href = link.getAttribute('href');
              if (!href || !href.includes('/events/')) return;
              
              // Get name from h3 (actual structure)
              let name = card.querySelector('h3')?.textContent?.trim() ||
                        link.getAttribute('title') ||
                        link.getAttribute('aria-label') || '';
              
              // Get date - usually in a time element or specific class
              const dateText = card.querySelector('time')?.textContent?.trim() ||
                              card.querySelector('[class*="dateTime"]')?.textContent?.trim() || '';
              
              // Get image
              const image = card.querySelector('img')?.getAttribute('src') || '';
              
              if (name && href) {
                // Clean up the URL (remove query params for deduplication)
                const cleanUrl = href.split('?')[0];
                const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://www.meetup.com${cleanUrl}`;
                
                results.push({
                  name: name,
                  url: fullUrl,
                  dateText: dateText,
                  image: image
                });
              }
            } catch (e) {
              // Skip
            }
          });
          
          return results;
        });
        
        // Process and add events
        pageEvents.forEach(event => {
          if (!isGenericStatusMessage(event.name) && !events.some(e => e.url === event.url)) {
            events.push({
              source: 'meetup',
              name: event.name,
              url: event.url,
              dateText: event.dateText,
              image: event.image,
              priceText: '',
              location: 'Norway',
              country: 'Norway',
              category: 'technology'
            });
          }
        });
        
        await page.close();
        await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (err) {
        console.warn(`  ⚠️  Meetup scrape failed for ${url}: ${err.message}`);
      }
    }
    
    if (browser) await browser.close();
    console.log(`  Found ${events.length} Meetup events`);
  } catch (error) {
    console.error('Meetup scraping error:', error.message);
    if (browser) await browser.close();
  }
  
  return events;
}

// ==================== BILLETTO.NO SCRAPER (Using Puppeteer for JS-rendered content) ====================
async function scrapeBilletto() {
  console.log('🔍 Scraping Billetto.no Norway Events...');
  const events = [];
  let browser = null;
  
  try {
    // Billetto uses JavaScript rendering, so we need Puppeteer
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const urls = [
      'https://billetto.no/search?q=tech',
      'https://billetto.no/search?q=technology',
      'https://billetto.no/search?q=teknologi',
      'https://billetto.no/search?q=AI',
      'https://billetto.no/search?q=kunstig+intelligens',
      'https://billetto.no/search?q=developer',
      'https://billetto.no/search?q=software',
      'https://billetto.no/search?q=programmering'
    ];
    
    for (let baseUrl of urls) {
      // Scrape at least 5 pages for each search query
      for (let pageNum = 1; pageNum <= 5; pageNum++) {
        const url = `${baseUrl}&page=${pageNum}`;
        try {
          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          console.log(`   📄 Scraping Billetto: ${url.split('?')[1] || url}...`);
          
          // Wait for event cards to appear (Billetto uses various classes)
          try {
            await page.waitForSelector('a[href*="/e/"], a[href*="/events/"]', { timeout: 10000 });
          } catch (e) {}
          
          // Extract events from the page
          const pageEvents = await page.evaluate(() => {
            const results = [];
            const eventCards = document.querySelectorAll('a[href*="/e/"], a[href*="/events/"]');
            
            eventCards.forEach(link => {
              try {
                const href = link.getAttribute('href');
                if (!href) return;
                
                // 1. Try to get name
                let name = '';
                const ldJsonScript = link.querySelector('script[type="application/ld+json"]');
                if (ldJsonScript) {
                  try {
                    const data = JSON.parse(ldJsonScript.textContent);
                    name = data.name || '';
                  } catch (e) {}
                }
                
                if (!name) {
                  name = link.querySelector('p.font-medium span')?.textContent?.trim() || 
                         link.querySelector('[x-text*="name_truncated"]')?.textContent?.trim() || 
                         link.querySelector('[x-text*="name"]')?.textContent?.trim() || '';
                }
                
                // 2. Try to get description/summary for better filtering
                let description = link.querySelector('[class*="description"], [class*="summary"], p:not(.font-medium)')?.textContent?.trim() || '';
                
                if (name && name.length > 5) {
                  const fullUrl = href.startsWith('http') ? href : `https://billetto.no${href}`;
                  results.push({
                    name: name,
                    url: fullUrl,
                    description: description
                  });
                }
              } catch (e) {}
            });
            return results;
          });
          
          let pageAdded = 0;
          pageEvents.forEach(event => {
            if (!isGenericStatusMessage(event.name) && !events.some(e => e.url === event.url)) {
              events.push({
                source: 'billetto.no',
                name: event.name,
                url: event.url,
                description: event.description,
                dateText: '',
                priceText: '',
                image: '',
                location: 'Norway',
                country: 'Norway'
              });
              pageAdded++;
            }
          });
          
          await page.close();
          if (pageAdded === 0) break; // If no new events found on this page, stop pagination for this query
          
        } catch (err) {
          console.warn(`  ⚠️  Billetto scrape failed for ${url}: ${err.message}`);
        }
      }
    }
    
    if (browser) await browser.close();
    console.log(`  Found ${events.length} Billetto events`);
  } catch (error) {
    console.error('Billetto scraping error:', error.message);
    if (browser) await browser.close();
  }
  
  return events;
}

// ==================== MAIN SCRAPER ====================
async function scrapeAllSources() {
  console.log('🚀 Starting Multi-Source Event Scraper for Norway\n');
  console.log('📍 Sources: Eventbrite, Meetup.com, Billetto.no\n');
  
  const allEvents = [];
  
  // Run all scrapers (only the three main sources)
  const scrapers = [
    scrapeEventbrite(),
    scrapeMeetup(),
    scrapeBilletto()
  ];
  
  const results = await Promise.allSettled(scrapers);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    } else {
      const scraperNames = ['Eventbrite', 'Meetup', 'Billetto'];
      console.error(`❌ ${scraperNames[index]} scraper failed:`, result.reason?.message || 'Unknown error');
    }
  });
  
  // Filter for tech-related events
  const techEvents = allEvents.filter(event => {
    const text = `${event.name} ${event.description || ''} ${event.organizer || ''}`.toLowerCase();
    
    // Check if event matches any tech keyword
    const matchesTechKeyword = TECH_KEYWORDS.some(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      // Use word boundaries for short keywords (like AI, AWS, API, Tech)
      if (lowerKeyword.length <= 4) {
        const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
        return regex.test(text);
      }
      return text.includes(lowerKeyword);
    });
    
    // Check if event matches any excluded keyword
    const matchesExcludedKeyword = EXCLUDED_KEYWORDS.some(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
      return regex.test(text);
    });
    
    // Stricter filtering: must match tech AND NOT match excluded
    return matchesTechKeyword && !matchesExcludedKeyword;
  });
  
  console.log(`\n✅ Total events scraped: ${allEvents.length}`);
  console.log(`🎯 Tech-related events: ${techEvents.length}`);
  
  // STEP: Check against database for existence
  console.log('\n🔍 Checking for existing events in database...');
  const newEvents = [];
  for (let i = 0; i < techEvents.length; i++) {
    const event = techEvents[i];
    const eventUrl = event.url || event.externalRedirectUrl;
    
    // Check if it exists in DB
    const exists = await checkIfEventExists(eventUrl);
    
    if (exists) {
      console.log(`⏭️  Skipping existing event: ${event.name}`);
    } else {
      newEvents.push(event);
    }
  }
  
  console.log(`✨ New events found: ${newEvents.length}`);
  
  // Save raw scraped data (only the new ones)
  const outputPath = './scraped-raw.json';
  fs.writeFileSync(outputPath, JSON.stringify(newEvents, null, 2));
  console.log(`\n💾 Saved ${newEvents.length} new events to ${outputPath}`);
  
  return newEvents;
}

// Run if called directly
const isDirectRun = import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) || 
                   import.meta.url.includes(process.argv[1].replace(/\\/g, '/'));

if (isDirectRun || process.argv[1].includes('scraper.js')) {
  scrapeAllSources().then(() => closePool()).catch(err => {
    console.error(err);
    closePool();
  });
}

export { scrapeAllSources };
