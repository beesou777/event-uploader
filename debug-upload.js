import fs from 'fs';
import FormData from 'form-data';

const events = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));

// Get event #2 (ISTQB Advanced) which has 0 features and is failing
const event = events[1];

console.log('Event:', event.name);
console.log('Features:', JSON.stringify(event.features));
console.log('\nBuilding form data...\n');

const form = new FormData();

// Simulate the safeAppend function
const safeAppend = (key, value) => {
  if (value !== null && value !== undefined) {
    form.append(key, String(value));
    console.log(`✓ Appended: ${key} = ${String(value).substring(0,50)}`);
  }
};

// Add basic fields
safeAppend('eventDetails[name]', event.name);
safeAppend('eventDetails[description]', event.description);

// Features logic from upload.js
const validFeatures = event.features?.filter(f => f && typeof f === 'string' && f.trim() !== '') || [];
console.log(`\nValid features count: ${validFeatures.length}`);

if (validFeatures.length > 0) {
  validFeatures.forEach((f, i) => {
    safeAppend(`eventDetails[features][${i}]`, f);
  });
} else {
  console.log('No features to send (as intended)');
}

console.log('\n--- All form fields ---');
console.log(Object.keys(form.getHeaders()));

// Check what's actually in the form
const formKeys = [];
form.on('data', (chunk) => {
  const str = chunk.toString();
  const match = str.match(/name="([^"]+)"/);
  if (match) formKeys.push(match[1]);
});

setTimeout(() => {
  console.log('\nForm field names:', formKeys);
}, 100);

