const fs = require("fs");

// 💋 Convert a single Eventbrite event into your backend format
function convertEventbriteToCreateEventDto(e) {
  // ----- CATEGORY IDS -----
  const categoryIds = (e.tags || [])
    .map(t => {
      const match = t.tag?.match(/(\d+)/);
      return match ? Number(match[1]) : null;
    })
    .filter(Boolean);

  // ----- TICKETS -----
  const ticketInfo = e.ticket_availability || {};
  const minPrice = ticketInfo.minimum_ticket_price;
  const maxPrice = ticketInfo.maximum_ticket_price;

  // convert object to array like backend expects
  const tickets = [
    {
      name: "General Admission",
      description: "Tickets for the event",
      price: minPrice?.major_value ? Number(minPrice.major_value) : 0,
      maximumTicketCapacity: 1, // fallback, you can change if needed
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

  // ----- FEATURES from DESCRIPTION -----
  // Split description by periods and clean up
  const features = (e.summary || "")
    .split(".")
    .map(f => f.trim())
    .filter(f => f.length > 0); // Remove empty strings

  // ----- FINAL EVENT OBJECT -----
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
      instagram: undefined,
      linkedin: undefined,
      discord: undefined,
    },

    categoryIds,
    images: e.image?.url ? [e.image.url] : [],
    faqs: [],
    audience: [],
    features, // ✅ Now populated from description

    tickets,
    refundPolicy: "Please visit the respective Eventbrite page for refund policy",
    externalRedirectUrl: e.tickets_url || "",
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
const inputFile = "./meetup.json";
const outputFile = "./meetup-formatted.json";

try {
  const raw = fs.readFileSync(inputFile, "utf-8");
  const parsed = JSON.parse(raw);

  const result = convertResponse(parsed);

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

  console.log("💋 Done baby! output.json is ready for your backend 😘");
} catch (err) {
  console.error("❌ Error:", err);
}