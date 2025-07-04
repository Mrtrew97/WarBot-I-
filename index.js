require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is alive and well!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Emoji to name map
const EMOJI_TO_NAME = {
  '🔴': '🔴 Emergency',
  '🔵': '🔵 No war',
  '🟢': '🟢 Active War',
  '🟡': '🟡 Active Skirmish',
};

let warMessageId = null;

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    const guildId = process.env.GUILD_ID;
    const botChannelId = process.env.BOT_COMMANDS_CHANNEL_ID;
    const warChannelId = process.env.WAR_TIME_CHANNEL_ID;

    if (!guildId || !botChannelId || !warChannelId) {
      console.error('❌ One or more environment variables are missing: GUILD_ID, BOT_COMMANDS_CHANNEL_ID, WAR_TIME_CHANNEL_ID');
      return;
    }

    const guild = await client.guilds.fetch(guildId);
    console.log(`✅ Fetched guild: ${guild.name} (${guild.id})`);

    await guild.channels.fetch(); // Populate cache

    const botCommands = guild.channels.cache.get(botChannelId);
    const warChannel = guild.channels.cache.get(warChannelId);

    if (!botCommands) {
      console.error(`❌ BOT_COMMANDS_CHANNEL_ID (${botChannelId}) not found in guild.`);
      return;
    }

    if (!warChannel) {
      console.error(`❌ WAR_TIME_CHANNEL_ID (${warChannelId}) not found in guild.`);
      return;
    }

    console.log('📢 Sending war status message...');
    const warMessage = await botCommands.send({
      content: `🛡️ **Alliance War Status**\n\n🔵 = No War\n🟢 = Active War\n🟡 = Active Skirmish\n🔴 = Emergency Need Everyone`,
    });

    warMessageId = warMessage.id;
    console.log(`✅ War status message sent. Message ID: ${warMessageId}`);

    for (const emoji of ['🔵', '🟢', '🟡', '🔴']) {
      await warMessage.react(emoji);
      console.log(`➕ Reacted with ${emoji}`);
    }

    console.log('✅ All reactions added successfully.');
  } catch (error) {
    console.error('❌ Error in ready event:', error.stack || error);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.message.id !== warMessageId) return;

    const emoji = reaction.emoji.name;
    const newName = EMOJI_TO_NAME[emoji];
    if (!newName) {
      console.log(`⚠️ Unknown emoji used: ${emoji}`);
      return;
    }

    const guild = reaction.message.guild;
    const warChannel = guild.channels.cache.get(process.env.WAR_TIME_CHANNEL_ID);
    if (!warChannel) {
      console.error('❌ war-time channel not found by ID.');
      await reaction.users.remove(user.id); // still reset emoji
      return;
    }

    console.log(`✏️ Renaming channel ${warChannel.name} to ${newName}...`);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('⏰ Rename timed out after 15 seconds.')), 15000)
    );

    await Promise.race([
      warChannel.setName(newName),
      timeoutPromise
    ]);

    console.log(`✅ Renamed war-time to ${newName}`);
  } catch (err) {
    console.error('❌ Reaction handling failed or timed out:', err.stack || err);
  } finally {
    try {
      await reaction.users.remove(user.id);
      console.log(`🔁 Removed ${user.username}'s reaction`);
    } catch (e) {
      console.error('⚠️ Failed to remove reaction:', e.stack || e);
    }
  }
});

// Extra logging around login
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('✅ Discord client logged in successfully');
}).catch(err => {
  console.error('❌ Discord login failed:', err.stack || err);
});

// Catch uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason.stack || reason);
});
