import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  try {
    const result = await sql`SELECT version(), current_database(), now()`;
    console.log('✅ Successfully connected to Neon Database!');
    console.log('DB Info:', result[0]);

    const arts = await sql`SELECT count(*)::int as count FROM artworks`;
    const exhibitions = await sql`SELECT count(*)::int as count FROM exhibitions`;
    const paymentLinks = await sql`SELECT count(*)::int as count FROM payment_links`;
    const openCalls = await sql`SELECT count(*)::int as count FROM open_calls`;
    const openCallSubmissions = await sql`SELECT count(*)::int as count FROM open_call_submissions`;
    const contracts = await sql`SELECT count(*)::int as count FROM contracts_documents`;
    const mediaAssets = await sql`SELECT count(*)::int as count FROM media_assets`;
    
    console.log(`\n🏛️ ARTGALZIM NEON BACKEND ARCHITECTURE OVERVIEW:`);
    console.log(`   🎨 Artworks in DB:           ${arts[0].count}`);
    console.log(`   🖼️ Media Assets Cataloged:   ${mediaAssets[0].count}`);
    console.log(`   🏛️ Exhibitions:              ${exhibitions[0].count}`);
    console.log(`   📣 Open Calls:               ${openCalls[0].count}`);
    console.log(`   📥 Open Call Submissions:    ${openCallSubmissions[0].count}`);
    console.log(`   📄 Contracts & Documents:    ${contracts[0].count}`);
    console.log(`   💳 Payment Links & Invoices: ${paymentLinks[0].count}\n`);
  } catch (error) {
    console.error('❌ Connection error:', error);
  }
}

main();
