import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import { format, parseISO, addDays } from 'date-fns';
import puppeteer from 'puppeteer';

// ==================== SCRAPER CONFIGURATION ====================
const NORWAY_LOCATIONS = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Norway', 'Norge'];
const TECH_KEYWORDS = [
  'tech', 'technology', 'AI', 'artificial intelligence', 'startup', 'innovation',
  'digital', 'software', 'programming', 'coding', 'developer', 'data science',
  'machine learning', 'blockchain', 'cloud', 'cybersecurity', 'networking',
  'business', 'leadership', 'entrepreneur', 'career', 'learning', 'workshop',
  'conference', 'meetup', 'seminar', 'hackathon', 'future', 'IT', 'information technology',
  'web development', 'mobile', 'app development', 'devops', 'agile', 'scrum',
  'product management', 'UX', 'UI', 'design', 'marketing', 'sales', 'finance',
  'analytics', 'big data', 'IoT', 'automation', 'robotics', 'VR', 'AR',
  'fintech', 'healthtech', 'edtech', 'saas', 'api', 'microservices'
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
  
  try {
    // Use the direct tech events URL for Norway
    const url = 'https://www.eventbrite.com/d/norway/tech-events/';
          
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
                    
          // Try multiple ways to extract date (often contains real title!)
                    const dateText = $el.find('.Typography_root__487rx').eq(1).text().trim() ||
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
                      }
                    }
                  } catch (err) {
                    // Silent fail for individual event parsing
                  }
                });
    }
    
    console.log(`  Found ${events.length} events from Eventbrite`);
  } catch (error) {
    console.error('Eventbrite scraping error:', error.message);
  }
  
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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        // Wait for event cards to appear
        try {
          await page.waitForSelector('[data-testid="categoryResults-eventCard"]', { timeout: 10000 });
        } catch (e) {
          // If selector not found, wait a bit anyway
          await new Promise(resolve => setTimeout(resolve, 2000));
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
              
              // Get date from time tag
              const dateTime = card.querySelector('time[datetime]')?.getAttribute('datetime') ||
                             card.querySelector('time')?.textContent?.trim() || '';
              
              // Get group name (look for "by" text)
              const groupName = Array.from(card.querySelectorAll('div'))
                .find(div => div.textContent?.includes('by'))?.textContent?.replace('by', '').trim() || '';
              
              // Extract from URL if name is still empty
              if (!name || name.length < 5) {
                const match = href.match(/\/([^\/]+)\/events\//);
                if (match) {
                  name = match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
              }
              
              if (name && name.length > 5) {
                // Clean up the URL (remove query params for deduplication)
                const cleanUrl = href.split('?')[0];
                const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://www.meetup.com${cleanUrl}`;
                
                results.push({
                  name: name,
                  url: fullUrl,
                  dateTime: dateTime,
                  organizer: groupName
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
              dateTime: event.dateTime || '',
              organizer: event.organizer || '',
              location: 'Norway',
              country: 'Norway'
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
      'https://billetto.no/',
      'https://billetto.no/search?q=tech',
      'https://billetto.no/search?q=technology',
      'https://billetto.no/search?q=teknologi'
    ];
    
    for (const url of urls) {
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        // Wait for event cards to appear
        try {
          await page.waitForSelector('[data-testid="categoryResults-eventCard"]', { timeout: 10000 });
        } catch (e) {
          // If selector not found, wait a bit anyway
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Extract events from the page
        const pageEvents = await page.evaluate(() => {
          const results = [];
          
          // Try to find event links
          const eventLinks = document.querySelectorAll('a[href*="/e/"], a[href*="/events/"]');
          
          eventLinks.forEach(link => {
            try {
              const href = link.getAttribute('href');
              if (!href) return;
              
              // Get name
              let name = link.textContent?.trim() || 
                        link.getAttribute('aria-label') ||
                        link.getAttribute('title') ||
                        link.closest('div, article, li')?.querySelector('h1, h2, h3, h4')?.textContent?.trim() || '';
              
              // Extract from URL if needed
              if (!name || name.length < 5) {
                const match = href.match(/\/([^\/]+)$/);
                if (match) {
                  name = match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
              }
              
              if (name && name.length > 5) {
                const fullUrl = href.startsWith('http') ? href : `https://billetto.no${href}`;
                results.push({
                  name: name,
                  url: fullUrl
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
              source: 'billetto.no',
              name: event.name,
              url: event.url,
              dateText: '',
              priceText: '',
              image: '',
              location: 'Norway',
              country: 'Norway'
            });
          }
        });
        
        await page.close();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (err) {
        console.warn(`  ⚠️  Billetto scrape failed for ${url}: ${err.message}`);
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
    // Check if event matches any keyword OR if it's from a tech source
    const matchesKeyword = TECH_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
    const isTechSource = event.source === 'eventbrite' || event.source === 'meetup' || event.source === 'billetto.no' ||
                        (event.category && ['technology', 'science-tech', 'startup', 'innovation'].includes(event.category));
    
    return matchesKeyword || isTechSource;
  });
  
  console.log(`\n✅ Total events scraped: ${allEvents.length}`);
  console.log(`🎯 Tech-related events: ${techEvents.length}`);
  
  // Save raw scraped data
  const outputPath = './scraped-raw.json';
  fs.writeFileSync(outputPath, JSON.stringify(techEvents, null, 2));
  console.log(`\n💾 Saved to ${outputPath}`);
  
  return techEvents;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeAllSources().catch(console.error);
}

export { scrapeAllSources };

