import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
dotenv.config();

const CONFIG = {
  API_URL: process.env.API_URL || 'https://eventeir-backend.ambitiouscliff-a806dce8.eastus.azurecontainerapps.io/api/v1/events/create/v2',
  LOGIN_URL: process.env.LOGIN_URL || 'https://eventeir-backend.ambitiouscliff-a806dce8.eastus.azurecontainerapps.io/api/v1/auth/login',
  LOGIN_EMAIL: process.env.LOGIN_EMAIL || 'shahbishwa21@gmail.com',
  LOGIN_PASSWORD: process.env.LOGIN_PASSWORD || 'Test@123',
  FILES: {
    converted: './output.json'
  }
};

async function login() {
  try {
    const response = await axios.post(CONFIG.LOGIN_URL, {
      email: CONFIG.LOGIN_EMAIL,
      password: CONFIG.LOGIN_PASSWORD
    });
    return response.data.data.accessToken;
  } catch (error) {
    console.error('Login failed:', error.message);
    return null;
  }
}

async function fetchImageAsBuffer(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    return { buffer: Buffer.from(response.data), contentType: response.headers['content-type'] || 'image/jpeg' };
  } catch (error) {
    return null;
  }
}

async function buildFormData(eventData) {
  const form = new FormData();
  
  // Top level fields as per CreateEventV2Dto
  form.append("refundPolicy", String(eventData.refundPolicy || "No refund policy"));
  form.append("ticket_currency", String(eventData.ticketCurrency || "NOK"));
  form.append("subscriptionPlanId", String(eventData.subscriptionPlanId || 1));

  // Event details as per CreateEventDto (nested inside eventDetails)
  const eventDetails = {
    name: eventData.name,
    description: eventData.description,
    capacity: eventData.capacity || 100,
    lang: eventData.lang || "en",
    startDate: eventData.startDate,
    endDate: eventData.endDate,
    isPhysical: eventData.isPhysical,
    slug: eventData.slug || "",
    externalRedirectUrl: eventData.externalRedirectUrl || "",
    venue: eventData.venue || "",
    city: eventData.city || "",
    state: eventData.state || "",
    country: eventData.country || "",
    address1: eventData.address1 || "",
    address2: eventData.address2 || "",
    startTime: eventData.startTime || "",
    endTime: eventData.endTime || "",
    longitude: eventData.longitude || 0,
    latitude: eventData.latitude || 0
  };
  
  Object.entries(eventDetails).forEach(([key, value]) => {
    form.append(`eventDetails[${key}]`, String(value));
  });
  
  // Category IDs inside eventDetails
  if (eventData.categoryIds && Array.isArray(eventData.categoryIds)) {
    eventData.categoryIds.forEach((id, i) => {
      form.append(`eventDetails[categoryIds][${i}]`, String(id));
    });
  }
  
  // FAQs inside eventDetails
  if (eventData.faqs && Array.isArray(eventData.faqs)) {
    eventData.faqs.forEach((faq, i) => {
      form.append(`eventDetails[faqs][${i}][question]`, String(faq.question));
      form.append(`eventDetails[faqs][${i}][answer]`, String(faq.answer));
    });
  }
  
  // Tickets at top level
  const ticketsArray = Array.isArray(eventData.tickets) ? eventData.tickets : [];
  ticketsArray.forEach((ticket, i) => {
    form.append(`tickets[${i}][name]`, String(ticket.name || "General Admission"));
    form.append(`tickets[${i}][description]`, String(ticket.description || ""));
    form.append(`tickets[${i}][price]`, String(Math.floor(ticket.price || 0)));
    form.append(`tickets[${i}][maximumTicketCapacity]`, String(ticket.maximumTicketCapacity || 100));
  });
  
  if (eventData.images && eventData.images.length > 0) {
    const imageUrl = eventData.images[0];
    const imageFile = await fetchImageAsBuffer(imageUrl);
    if (imageFile) {
      form.append("images", imageFile.buffer, {
        filename: `image-0.jpg`,
        contentType: imageFile.contentType,
      });
    }
  } else {
    const placeholderImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    form.append("images", placeholderImage, {
        filename: 'placeholder.png',
        contentType: 'image/png',
    });
  }
  
  return form;
}

async function testUpload() {
  const token = await login();
  if (!token) return;

  const events = JSON.parse(fs.readFileSync(CONFIG.FILES.converted, 'utf-8'));
  const event = events[0];

  console.log('🚀 Testing upload for:', event.name);
  const form = await buildFormData(event);

  try {
    const response = await axios.post(CONFIG.API_URL, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    console.log('✅ Success:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Error Message:', error.message);
    console.error('❌ Error Status:', error.response?.status);
    console.error('❌ Error Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

testUpload();
