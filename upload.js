import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import atob from "atob";

// ------------- CONFIG ------------------
const INPUT_FILE = "./output.json";
const API_URL = "https://eventeir.roshankarki1.com.np/api/v1/events/create/v2";
const ACCESS_TOKEN ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InNoYWhiaXNod2EyMUBnbWFpbC5jb20iLCJmdWxsTmFtZSI6ImJpc2h3YSBzaGFoIiwiZ2VuZGVyIjpudWxsLCJpZCI6Miwicm9sZSI6Ik9SR0FOSVpFUiIsImlhdCI6MTc2NDI1MjAyNCwiZXhwIjoxNzY0MjY2NDI0fQ.2GqKhxTjNqarJ3mB_cXkBsznMxB5Ly_1gkLaIHboosY";

// Fetch image from URL and convert to Buffer
async function fetchImageAsBuffer(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    return { buffer, contentType };
  } catch (error) {
    console.error(`Failed to fetch image ${imageUrl}:`, error.message);
    return null;
  }
}

// Convert base64 → Buffer (for existing base64 strings)
function base64ToBuffer(base64String) {
  const match = base64String.match(/^data:(.*);base64,(.*)$/);
  if (!match) return null;

  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return { buffer: Buffer.from(bytes), mime };
}

// Helper to safely append to FormData
function safeAppend(form, key, value) {
  if (value !== null && value !== undefined) {
    form.append(key, String(value));
  }
}

// Build formData
async function buildFormData(eventData) {
  const form = new FormData();

  // Default coordinates for Oslo if missing (API requires them)
  const defaultCoords = {
    longitude: 10.7522,
    latitude: 59.9139
  };
  
  // Append eventDetails basic fields
  const eventDetails = {
    description: eventData.description,
    name: eventData.name,
    isPhysical: eventData.isPhysical,
    additionalInfo: eventData.additionalInfo || '',
    theme: eventData.theme || '',
    lang: eventData.lang,
    startDate: eventData.startDate,
    endDate: eventData.endDate,
    venue: eventData.venue,
    city: eventData.city,
    state: eventData.state,
    country: eventData.country,
    address1: eventData.address1,
    address2: eventData.address2,
    longitude: eventData.longitude || defaultCoords.longitude,
    latitude: eventData.latitude || defaultCoords.latitude,
    externalRedirectUrl: eventData.externalRedirectUrl,
    capacity: eventData.capacity || 100,
    platform: eventData.platform ?? "",
  };

  Object.entries(eventDetails).forEach(([key, value]) => {
    safeAppend(form, `eventDetails[${key}]`, value);
  });

  // Features - only add if array has valid strings (don't send empty array)
  const validFeatures = eventData.features?.filter(f => f && typeof f === 'string' && f.trim() !== '') || [];
  if (validFeatures.length > 0) {
    validFeatures.forEach((f, i) => {
      safeAppend(form, `eventDetails[features][${i}]`, f);
    });
  }
  // Note: If no features, we intentionally don't send the field at all

  // Category IDs
  eventData.categoryIds?.forEach((c, i) => {
    safeAppend(form, `eventDetails[categoryIds][${i}]`, c);
  });

  // FAQs
  eventData.faqs?.forEach((faq, i) => {
    safeAppend(form, `eventDetails[faqs][${i}][question]`, faq.question);
    safeAppend(form, `eventDetails[faqs][${i}][answer]`, faq.answer);
  });

  // Audience
  eventData.audience?.forEach((a, i) => {
    safeAppend(form, `eventDetails[audience][${i}]`, a);
  });

  // Refund policy & currency
  safeAppend(form, "refundPolicy", eventData.refundPolicy ?? "");
  safeAppend(form, "ticket_currency", "NOK");

  // Subscription plan
  safeAppend(form, "subscriptionPlanId", 1);

  // Tickets
  const ticketsArray = Array.isArray(eventData.tickets)
    ? eventData.tickets
    : eventData.ticket
    ? [eventData.ticket]
    : [];

  ticketsArray.forEach((ticket, i) => {
    safeAppend(form, `tickets[${i}][name]`, ticket.name ?? "General Admission");
    safeAppend(form, `tickets[${i}][description]`, ticket.description ?? "");
    safeAppend(form, `tickets[${i}][price]`, Math.floor(ticket.price) ?? 0);
    safeAppend(form, `tickets[${i}][maximumTicketCapacity]`, ticket.maximumTicketCapacity ?? 1);
  });

  // ✅ Images: Handle both URLs and base64 strings
  let imageAdded = false;
  if (eventData.images && eventData.images.length > 0) {
    for (let i = 0; i < eventData.images.length; i++) {
      const imageData = eventData.images[i];
      
      // Skip null or invalid images
      if (!imageData || typeof imageData !== 'string') continue;
      
      // Check if it's a URL or base64
      if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        // Fetch image from URL
        console.log(`  Fetching image ${i + 1}/${eventData.images.length}...`);
        const imageFile = await fetchImageAsBuffer(imageData);
        if (imageFile) {
          form.append("images", imageFile.buffer, {
            filename: `image-${i}.jpg`,
            contentType: imageFile.contentType,
          });
          imageAdded = true;
        }
      } else if (imageData.startsWith('data:')) {
        // Convert base64 to buffer
        const file = base64ToBuffer(imageData);
        if (file) {
          form.append("images", file.buffer, {
            filename: `image-${i}.jpg`,
            contentType: file.mime,
          });
          imageAdded = true;
        }
      }
    }
  }
  
  // If no images were added, create a placeholder (API requires at least one image)
  if (!imageAdded) {
    console.log(`  No valid images, using placeholder...`);
    const placeholderImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    form.append("images", placeholderImage, {
      filename: 'placeholder.png',
      contentType: 'image/png',
    });
  }

  return form;
}

// Send to server
async function uploadEvent(eventData) {
  const form = await buildFormData(eventData);

  const res = await axios.post(API_URL, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return res.data;
}

// Main runner
async function main() {
  const events = JSON.parse(fs.readFileSync(INPUT_FILE));

  console.log(`Found ${events.length} events to upload\n`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    try {
      console.log(`[${i + 1}/${events.length}] Uploading: ${event.name}`);

      const result = await uploadEvent(event);
      console.log("✅ SUCCESS\n");
    } catch (err) {
      console.error("❌ ERROR:", err.message);
      if (err.response) {
        console.error("Response data:", err.response.data);
      }
      console.log();
    }
  }
  
  console.log("All done!");
}

main();