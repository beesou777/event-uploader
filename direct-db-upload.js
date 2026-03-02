import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import { uploadImageToAzure } from './azure-storage-utils.js';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_msIzNKg26ApR@ep-fragrant-morning-a8urnhqb-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false }
});

const OUTPUT_FILE = './output.json';
const CREATOR_ID = 3; // Switched to 3 as 2 does not exist in DB

async function uploadToDb() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`❌ File not found: ${OUTPUT_FILE}`);
    return;
  }

  const events = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
  console.log(`📂 Loaded ${events.length} events from ${OUTPUT_FILE}`);

  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const event of events) {
    try {
      // Check if already exists (safeguard)
      const existingRes = await pool.query(
        'SELECT id FROM events WHERE "externalRedirectUrl" = $1 LIMIT 1',
        [event.externalRedirectUrl]
      );

      if (existingRes.rowCount > 0) {
        console.log(`⏭️  Skipping existing event: ${event.name}`);
        skippedCount++;
        continue;
      }

      console.log(`🚀 Processing event: ${event.name}`);

      // STEP 1: Upload images to Azure Storage
      const azureImages = [];
      if (event.images && Array.isArray(event.images)) {
        for (const imgUrl of event.images) {
          const uploaded = await uploadImageToAzure(imgUrl);
          if (uploaded) {
            azureImages.push(uploaded);
          }
        }
      }

      // STEP 2: Insert Event into DB
      const query = `
        INSERT INTO events (
          name, slug, "startTime", "endTime", description, "externalRedirectUrl",
          capacity, "totalViews", lang, "startDate", "endDate", venue,
          country, city, state, platform, address1, address2,
          longitude, latitude, "isPhysical", "categoryIds", "ticketCurrency",
          "isDraft", "isFree", "isDeleted", "isCreatedByVerifiedUser",
          "recievePayment", "creatorId", faqs, "fromPrice", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, NOW(), NOW()
        ) RETURNING id
      `;

      const values = [
        event.name,
        event.slug,
        event.startTime || null,
        event.endTime || null,
        event.description,
        event.externalRedirectUrl,
        event.capacity || 100,
        0, // totalViews
        event.lang || 'en',
        new Date(event.startDate),
        new Date(event.endDate),
        event.venue || null,
        event.country || 'Norway',
        event.city || null,
        event.state || null,
        event.platform || null,
        event.address1 || null,
        event.address2 || null,
        event.longitude || 0,
        event.latitude || 0,
        event.isPhysical === undefined ? true : event.isPhysical,
        event.categoryIds || [],
        event.ticketCurrency || 'NOK',
        event.isDraft || false,
        event.isFree || false,
        event.isDeleted || false,
        event.isCreatedByVerifiedUser === undefined ? true : event.isCreatedByVerifiedUser,
        event.recievePayment || false,
        CREATOR_ID,
        JSON.stringify(event.faqs || []),
        event.fromPrice || 0
      ];

      const res = await pool.query(query, values);
      const eventId = res.rows[0].id;
      console.log(`✅ Event created in DB: ${event.name} (ID: ${eventId})`);

      // STEP 3: Insert Media records linked to the event
      let firstMediaId = null;
      for (const img of azureImages) {
        const mediaQuery = `
          INSERT INTO media (
            "blobName", mimetype, "creatorId", "isDeleted", "eventId", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id
        `;
        const mediaValues = [
          img.url, // Storing full URL in blobName
          img.mimetype,
          CREATOR_ID,
          false,
          eventId
        ];
        const mediaRes = await pool.query(mediaQuery, mediaValues);
        if (!firstMediaId) firstMediaId = mediaRes.rows[0].id;
      }
      
      // Update event with thumbnailImageId and thumbnailImageBulbName
      if (firstMediaId && azureImages.length > 0) {
        await pool.query(
          'UPDATE events SET "thumbnailImageId" = $1, "thumbnailImageBulbName" = $2 WHERE id = $3', 
          [firstMediaId, azureImages[0].url, eventId]
        );
        console.log(`🖼️  Linked ${azureImages.length} images to event.`);
      }

      uploadedCount++;
    } catch (err) {
      console.error(`❌ Error uploading "${event.name}":`, err.message);
      errorCount++;
    }
  }

  console.log('\n📊 DB Upload Summary:');
  console.log(`   Uploaded: ${uploadedCount}`);
  console.log(`   Skipped:  ${skippedCount}`);
  console.log(`   Errors:   ${errorCount}`);

  // Sync categories after upload (as per previous script version)
  console.log('\n🔄 Syncing categories and join table...');
  const MAIN_CATEGORIES = [
    { id: 1, name: 'Tech & AI' },
    { id: 2, name: 'Business & Leadership' },
    { id: 3, name: 'Science & Education' },
    { id: 4, name: 'Networking & Community' }
  ];

  try {
    for (const cat of MAIN_CATEGORIES) {
      await pool.query(
        'INSERT INTO category (id, name, "creatorId", "isDeleted", "createdAt", "updatedAt") VALUES ($1, $2, $3, false, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name = $2',
        [cat.id, cat.name, CREATOR_ID]
      );
    }

    const eventsRes = await pool.query('SELECT id, "categoryIds" FROM events');
    let joinCount = 0;
    for (const row of eventsRes.rows) {
      if (row.categoryIds && Array.isArray(row.categoryIds)) {
        for (const catId of row.categoryIds) {
          const linkCheck = await pool.query(
            'SELECT 1 FROM events_categories_category WHERE "eventsId" = $1 AND "categoryId" = $2',
            [row.id, catId]
          );
          if (linkCheck.rowCount === 0) {
            await pool.query(
              'INSERT INTO events_categories_category ("eventsId", "categoryId") VALUES ($1, $2)',
              [row.id, catId]
            );
            joinCount++;
          }
        }
      }
    }
    console.log(`✅ Categories synced and ${joinCount} relationships linked.`);
  } catch (err) {
    console.error('❌ Category sync error:', err.message);
  }

  await pool.end();
}

uploadToDb();
