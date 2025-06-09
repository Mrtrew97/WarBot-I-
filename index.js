require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  process.exit(0); // Exit after successful login for test
});

client.on('error', (error) => {
  console.error('❌ Client error:', error);
  process.exit(1);
});

console.log('🔄 Starting Discord client login...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Bot login failed:', err);
  process.exit(1);
});

// Add a timeout to fail if stuck
setTimeout(() => {
  console.error('❌ ERROR: Bot login timed out after 30 seconds');
  process.exit(1);
}, 30000);
