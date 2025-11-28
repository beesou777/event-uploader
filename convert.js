const fs = require("fs");

const categoryList = [
  { id: 1, name: 'Distributed Systems', keywords: ['distributed', 'systems', 'cluster'] },
  { id: 2, name: 'Microservices Architecture', keywords: ['microservices', 'architecture', 'service-oriented'] },
  { id: 3, name: 'API Engineering', keywords: ['api', 'rest', 'graphql', 'endpoint'] },
  { id: 4, name: 'Cloud Security', keywords: ['cloud', 'security', 'aws', 'gcp', 'azure'] },
  { id: 5, name: 'Edge Computing', keywords: ['edge', 'iot', 'latency'] },
  { id: 6, name: 'Quantum Computing', keywords: ['quantum', 'qubits', 'qc'] },
  { id: 7, name: 'LLM / Generative AI', keywords: ['llm', 'gpt', 'chatgpt', 'generative', 'ai'] },
  { id: 8, name: 'Automation & RPA', keywords: ['automation', 'rpa', 'robot'] },
  { id: 9, name: 'Enterprise Architecture', keywords: ['enterprise', 'architecture', 'b2b'] },
  { id: 10, name: 'Networking & Infrastructure', keywords: ['network', 'infrastructure', 'server', 'tcp'] },
  { id: 11, name: 'Systems Programming', keywords: ['systems', 'low-level', 'c', 'rust', 'kernel'] },
  { id: 12, name: 'Database Engineering', keywords: ['database', 'sql', 'nosql', 'mongodb', 'postgres'] },
  { id: 13, name: 'Open Source & Community', keywords: ['open source', 'github', 'community', 'opensource'] },
  { id: 14, name: 'Frontend Engineering', keywords: ['frontend', 'react', 'vue', 'angular', 'ui'] },
  { id: 15, name: 'Backend Engineering', keywords: ['backend', 'node', 'express', 'server'] },
  { id: 16, name: 'Full-Stack Development', keywords: ['fullstack', 'full-stack', 'frontend', 'backend'] },
  { id: 17, name: 'DevSecOps', keywords: ['devsecops', 'security', 'ci/cd', 'pipeline'] },
  { id: 18, name: 'Site Reliability Engineering (SRE)', keywords: ['sre', 'reliability', 'ops'] },
  { id: 19, name: 'Platform Engineering', keywords: ['platform', 'engineering', 'infra'] },
  { id: 20, name: 'Embedded Systems', keywords: ['embedded', 'microcontroller', 'arduino', 'iot'] },
  { id: 21, name: 'Product Management', keywords: ['product', 'manager', 'pm', 'roadmap'] },
  { id: 22, name: 'Design Systems', keywords: ['design system', 'ui', 'ux', 'component'] },
  { id: 23, name: 'Tech Innovation & Research', keywords: ['innovation', 'research', 'tech'] },
  { id: 24, name: 'Digital Transformation', keywords: ['digital', 'transformation', 'change'] },
  { id: 25, name: 'Low-Code / No-Code Development', keywords: ['low-code', 'nocode', 'no-code'] },
  { id: 26, name: '3D Modeling & Animation', keywords: ['3d', 'animation', 'modeling'] },
  { id: 27, name: 'Digital Art & Creative Tech', keywords: ['digital art', 'creative', 'design'] },
  { id: 28, name: 'Audio Engineering', keywords: ['audio', 'sound', 'music', 'engineering'] },
  { id: 29, name: 'Esports & Gaming Industry', keywords: ['gaming', 'esports', 'games'] },
  { id: 30, name: 'Tech Leadership', keywords: ['cto', 'leader', 'executive', 'management'] },
  { id: 31, name: 'Engineering Management', keywords: ['engineering', 'manager', 'team lead'] },
  { id: 32, name: 'Startup Fundraising', keywords: ['startup', 'fundraising', 'venture', 'investor'] },
  { id: 33, name: 'Tech Entrepreneurship', keywords: ['entrepreneur', 'startup', 'founder'] },
  { id: 34, name: 'Tech Marketing & Growth', keywords: ['marketing', 'growth', 'saas', 'tech'] },
];

// 💋 Convert a single Eventbrite event into your backend format
function convertEventbriteToCreateEventDto(e) {
  // ----- CATEGORY IDS (Auto Matched) -----
  const categoryIds = matchCategories(e, categoryList);

  // ----- TICKETS -----
  const ticketInfo = e.ticket_availability || {};
  const minPrice = ticketInfo.minimum_ticket_price;
  const maxPrice = ticketInfo.maximum_ticket_price;

  const tickets = [
    {
      name: "General Admission",
      description: "Tickets for the event",
      price: minPrice?.major_value ? Number(minPrice.major_value) : 0,
      maximumTicketCapacity: 1,
      currency: minPrice?.currency || maxPrice?.currency || "NOK",
      isFree: ticketInfo.is_free ?? false,
      hasAvailableTickets: ticketInfo.has_available_tickets ?? false,
      isSoldOut: ticketInfo.is_sold_out ?? false,
      hasBogo: ticketInfo.has_bogo_tickets ?? false,
      priceRange:
        minPrice && maxPrice
          ? `${minPrice.major_value} - ${maxPrice.major_value}`
          : null,
    },
  ];

  // ----- FEATURES -----
  const features = (e.summary || "")
    .split(".")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  // ----- FINAL RESPONSE -----
  return {
    name: e.name || "",
    slug: e.name
      ?.toLowerCase()
      ?.replace(/[^a-z0-9]+/g, "-")
      ?.replace(/^-|-$/g, ""),

    description: e.summary || "",
    additionalInfo: "",
    theme: "",
    capacity: e.capacity || 1,
    lang: (e.language || "en").substring(0, 2),

    startDate: new Date(`${e.start_date}T${e.start_time || "00:00"}`),
    endDate: new Date(`${e.end_date}T${e.end_time || "23:59"}`),

    venue: e.primary_venue?.name || "",
    city: e.primary_venue?.address?.city || "",
    state: e.primary_venue?.address?.region || "",
    country: e.primary_venue?.address?.country || "",
    address1: e.primary_venue?.address?.address_1 || "",
    address2: e.primary_venue?.address?.address_2 || "",
    longitude: e.primary_venue?.address?.longitude
      ? Number(e.primary_venue.address.longitude)
      : undefined,
    latitude: e.primary_venue?.address?.latitude
      ? Number(e.primary_venue.address.latitude)
      : undefined,

    isPhysical: !e.is_online_event,
    platform: e.tickets_by || "",

    socialMedias: {
      facebook: e.primary_organizer?.facebook,
      twitter: e.primary_organizer?.twitter,
    },

    categoryIds,
    images: e.image?.original?.url ? [e.image.original.url] : [e.image?.url],
    faqs: [],
    audience: [],
    features,

    tickets,
    refundPolicy:
      "Please visit the respective page for refund policy",
    externalRedirectUrl: e.url || "",
  };
}

// 💖 Convert all events in JSON
function convertResponse(json) {
  if (!json.events || !Array.isArray(json.events)) {
    throw new Error("JSON must contain events array");
  }
  return json.events.map(convertEventbriteToCreateEventDto);
}

// ----------------- READ + WRITE -------------------
const inputFile = "./data.json";
const outputFile = "./output.json";

try {
  const raw = fs.readFileSync(inputFile, "utf-8");
  const parsed = JSON.parse(raw);

  const result = convertResponse(parsed);

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

  console.log("💋 Done baby! output.json is ready for your backend 😘");
} catch (err) {
  console.error("❌ Error:", err);
}

function extractText(eventJson) {
  let collected = "";

  // name, summary, venue, tags etc.
  collected += " " + (eventJson.name || "");
  collected += " " + (eventJson.summary || "");

  if (eventJson.tags) {
    collected +=
      " " + eventJson.tags.map((t) => t.display_name || "").join(" ");
  }

  return collected.toLowerCase();
}

function matchCategories(eventJson, categoryList) {
  const text = extractText(eventJson);
  const matched = [];

  for (const cat of categoryList) {
    for (const key of cat.keywords) {
      if (text.includes(key.toLowerCase())) {
        matched.push(cat.id);
        break;
      }
    }
  }

  return matched;
}


