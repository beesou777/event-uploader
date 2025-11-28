import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import { format, parseISO, addDays } from 'date-fns';

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

// ==================== EVENTBRITE SCRAPER (ENHANCED) ====================
async function scrapeEventbrite() {
  console.log('🔍 Scraping Eventbrite Norway (Enhanced - Multiple Categories)...');
  const events = [];
  
  // Multiple categories to search
  const categories = [
    'technology',
    'business',
    'science-tech',
    'education',
    'conference',
    'workshop',
    'networking',
    'startup',
    'innovation'
  ];
  
  const locations = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Norway'];
  
  try {
    for (const location of locations) {
      for (const category of categories) {
        try {
          // Try multiple URL patterns
          const urls = [
            `https://www.eventbrite.com/d/norway--${location.toLowerCase()}/${category}/`,
            `https://www.eventbrite.com/d/${location.toLowerCase()}-norway/${category}/`,
            `https://www.eventbrite.com/d/norway/${category}/?q=${category}`
          ];
          
          for (const url of urls) {
            try {
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
                '.eds-event-card'
              ];
              
              let foundInThisPage = 0;
              
              for (const selector of selectors) {
                $(selector).each((i, el) => {
                  try {
                    const $el = $(el);
                    
                    // Try multiple ways to extract name
                    const name = $el.find('.Typography_root__487rx').first().text().trim() ||
                                $el.find('h2, h3, h4').first().text().trim() ||
                                $el.find('[class*="title"], [class*="name"]').first().text().trim() ||
                                $el.attr('aria-label') || '';
                    
                    // Try multiple ways to extract link
                    const link = $el.find('a').first().attr('href') ||
                                $el.attr('href') ||
                                $el.find('[href*="/e/"]').attr('href') || '';
                    
                    // Try multiple ways to extract date
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
                      
                      // Avoid duplicates
                      if (!events.some(e => e.url === fullUrl)) {
                        events.push({
                          source: 'eventbrite',
                          name: name,
                          url: fullUrl,
                          dateText: dateText,
                          priceText: priceText,
                          image: image,
                          location: location,
                          country: 'Norway',
                          category: category
                        });
                        foundInThisPage++;
                      }
                    }
                  } catch (err) {
                    // Silent fail for individual event parsing
                  }
                });
                
                if (foundInThisPage > 0) break; // Found events with this selector, move on
              }
              
              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (err) {
              // Silent fail for individual URL attempts
            }
          }
        } catch (err) {
          // Silent fail for category
        }
      }
      
      console.log(`  Found ${events.length} total events from ${location}`);
    }
  } catch (error) {
    console.error('Eventbrite scraping error:', error.message);
  }
  
  return events;
}

// ==================== MEETUP.COM SCRAPER (ENHANCED) ====================
async function scrapeMeetup() {
  console.log('🔍 Scraping Meetup.com Norway (Enhanced - Multiple Keywords & Cities)...');
  const events = [];
  
  try {
    const keywords = [
      'tech', 'technology', 'ai', 'artificial intelligence', 'machine learning',
      'startup', 'developer', 'programming', 'coding', 'software',
      'innovation', 'business', 'entrepreneur', 'networking',
      'data science', 'cybersecurity', 'cloud', 'blockchain',
      'web development', 'mobile development', 'devops'
    ];
    
    const cities = ['oslo', 'bergen', 'trondheim', 'stavanger', 'tromso'];
    
    for (const city of cities) {
      for (const keyword of keywords) {
        try {
          const url = `https://www.meetup.com/find/?keywords=${encodeURIComponent(keyword)}&location=no--${city}&source=EVENTS`;
          
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 15000
          });
          
          const $ = cheerio.load(response.data);
          
          // Multiple selector patterns
          const selectors = [
            '[data-event-id]',
            '[class*="eventCard"]',
            '.event-listing',
            'article[class*="event"]',
            '[data-testid="event-card"]'
          ];
          
          for (const selector of selectors) {
            $(selector).each((i, el) => {
              try {
                const $el = $(el);
                
                const name = $el.find('h3, h2, h4').first().text().trim() ||
                            $el.find('[class*="title"]').first().text().trim() || '';
                
                const dateTime = $el.find('time').attr('datetime') ||
                               $el.find('[datetime]').attr('datetime') ||
                               $el.find('[class*="date"]').first().text().trim() || '';
                
                const groupName = $el.find('[data-testid="group-name"]').text().trim() ||
                                $el.find('[class*="group"]').first().text().trim() || '';
                
                const link = $el.find('a').first().attr('href') ||
                           $el.attr('href') || '';
                
                if (name && link && name.length > 5) {
                  const fullUrl = link.startsWith('http') ? link : `https://www.meetup.com${link}`;
                  
                  // Avoid duplicates
                  if (!events.some(e => e.url === fullUrl)) {
                    events.push({
                      source: 'meetup',
                      name: name,
                      url: fullUrl,
                      dateTime: dateTime,
                      organizer: groupName,
                      location: city.charAt(0).toUpperCase() + city.slice(1),
                      country: 'Norway',
                      keyword: keyword
                    });
                  }
                }
              } catch (err) {
                // Silent fail
              }
            });
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (err) {
          // Silent fail for individual keyword
        }
      }
    }
    
    console.log(`  Found ${events.length} Meetup events`);
  } catch (error) {
    console.error('Meetup scraping error:', error.message);
  }
  
  return events;
}

// ==================== FINN.NO EVENTS SCRAPER ====================
async function scrapeFinnEvents() {
  console.log('🔍 Scraping Finn.no Events...');
  const events = [];
  
  try {
    const url = 'https://www.finn.no/bap/forsale/search.html?category=0.2020&q=tech';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    $('article').each((i, el) => {
      try {
        const $el = $(el);
        const name = $el.find('h2').text().trim();
        const link = $el.find('a').attr('href');
        const location = $el.find('[class*="location"]').text().trim();
        const price = $el.find('[class*="price"]').text().trim();
        
        if (name && link) {
          events.push({
            source: 'finn.no',
            name: name,
            url: link.startsWith('http') ? link : `https://www.finn.no${link}`,
            location: location,
            priceText: price,
            country: 'Norway'
          });
        }
      } catch (err) {
        console.error('Error parsing Finn event:', err.message);
      }
    });
    
    console.log(`  Found ${events.length} Finn.no events`);
  } catch (error) {
    console.error('Finn.no scraping error:', error.message);
  }
  
  return events;
}

// ==================== SPECIFIC TECH COMMUNITIES SCRAPER ====================
async function scrapeTechCommunities() {
  console.log('🔍 Scraping Norwegian Tech Communities...');
  const events = [];
  
  const communities = [
    {
      name: 'Oslo Tech Events',
      url: 'https://oslotechevents.com/',
      selectors: { title: 'h3', link: 'a', date: 'time' }
    },
    {
      name: 'TechBBQ Nordic',
      url: 'https://techbbq.org/',
      selectors: { title: 'h2', link: 'a' }
    }
  ];
  
  for (const community of communities) {
    try {
      const response = await axios.get(community.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      $(community.selectors.title).each((i, el) => {
        try {
          const $el = $(el).closest('article, div, section');
          const name = $(el).text().trim();
          const link = $el.find(community.selectors.link).attr('href');
          const date = community.selectors.date ? $el.find(community.selectors.date).text().trim() : '';
          
          if (name && link && name.length > 10) {
            events.push({
              source: community.name,
              name: name,
              url: link.startsWith('http') ? link : `${new URL(community.url).origin}${link}`,
              dateText: date,
              location: 'Oslo',
              country: 'Norway'
            });
          }
        } catch (err) {
          console.error(`Error parsing ${community.name} event:`, err.message);
        }
      });
      
      console.log(`  Found ${events.length} events from ${community.name}`);
    } catch (error) {
      console.error(`Error scraping ${community.name}:`, error.message);
    }
  }
  
  return events;
}

// ==================== GENERIC EVENT AGGREGATOR (ENHANCED) ====================
async function scrapeGenericEventSites() {
  console.log('🔍 Scraping Generic Event Sites (Enhanced - More Sources)...');
  const events = [];
  
  // Expanded list of event aggregator sites
  const sites = [
    { url: 'https://allevents.in/oslo/tech', city: 'Oslo' },
    { url: 'https://allevents.in/bergen/tech', city: 'Bergen' },
    { url: 'https://allevents.in/trondheim/tech', city: 'Trondheim' },
    { url: 'https://10times.com/norway/technology', city: 'Norway' },
    { url: 'https://www.eventful.com/oslo/events/tech', city: 'Oslo' },
    { url: 'https://www.ticketmaster.no/discover/tech', city: 'Norway' },
    { url: 'https://www.luvent.com/norway/technology', city: 'Norway' }
  ];
  
  for (const site of sites) {
    try {
      const response = await axios.get(site.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      
      // More comprehensive selectors
      const selectors = [
        '.event-card', '.event-item', '[class*="event"]',
        'article', '.card', '[data-event]', '.event-list-item',
        '[class*="EventCard"]', '[class*="eventCard"]', '.listing-item'
      ];
      
      for (const selector of selectors) {
        $(selector).each((i, el) => {
          try {
            const $el = $(el);
            const name = $el.find('h1, h2, h3, h4, .title, [class*="title"]').first().text().trim() ||
                        $el.attr('aria-label') || '';
            const link = $el.find('a').first().attr('href') ||
                        $el.attr('href') || '';
            const date = $el.find('time, .date, [class*="date"]').first().text().trim() ||
                        $el.find('time').attr('datetime') || '';
            const location = $el.find('.location, [class*="location"]').first().text().trim() ||
                           site.city || 'Norway';
            
            if (name && link && name.length > 5) {
              const fullUrl = link.startsWith('http') ? link : `${new URL(site.url).origin}${link}`;
              
              // Avoid duplicates
              if (!events.some(e => e.url === fullUrl)) {
                events.push({
                  source: new URL(site.url).hostname,
                  name: name,
                  url: fullUrl,
                  dateText: date,
                  location: location,
                  country: 'Norway'
                });
              }
            }
          } catch (err) {
            // Silent fail for generic scraping
          }
        });
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      // Silent fail for individual sites
    }
  }
  
  console.log(`  Found ${events.length} generic events`);
  return events;
}

// ==================== MAIN SCRAPER ====================
async function scrapeAllSources() {
  console.log('🚀 Starting Multi-Source Event Scraper for Norway\n');
  
  const allEvents = [];
  
  // Run all scrapers
  const scrapers = [
    scrapeEventbrite(),
    scrapeMeetup(),
    scrapeFinnEvents(),
    scrapeTechCommunities(),
    scrapeGenericEventSites()
  ];
  
  const results = await Promise.allSettled(scrapers);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    } else {
      console.error(`Scraper ${index + 1} failed:`, result.reason);
    }
  });
  
  // Filter for tech-related events (more lenient - keep more events)
  const techEvents = allEvents.filter(event => {
    const text = `${event.name} ${event.description || ''} ${event.organizer || ''}`.toLowerCase();
    // Check if event matches any keyword OR if it's from a tech source
    const matchesKeyword = TECH_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
    const isTechSource = event.source === 'eventbrite' || event.source === 'meetup' || 
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

