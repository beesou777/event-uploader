import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));

console.log('Checking features for all events:\n');

data.forEach((e, i) => {
  const featuresInfo = e.features && Array.isArray(e.features) 
    ? `${e.features.length} items` 
    : `NOT AN ARRAY: ${typeof e.features}`;
  
  console.log(`${i+1}. ${e.name.substring(0,60)}`);
  console.log(`   Features: ${featuresInfo}`);
  
  if (e.features && e.features.length > 0) {
    e.features.forEach((f, idx) => {
      console.log(`     [${idx}] Type: ${typeof f}, Value: "${f}"`);
    });
  }
  console.log();
});

