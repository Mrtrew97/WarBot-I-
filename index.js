require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ChannelType, Partials, Events } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is alive and well!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

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

const EMOJI_TO_NAME = {
  '🔴': '🔴 Emergency',
  '🔵': '🔵 No war Merit Trading Allowed',
  '🟢': '🟢 Active War',
  '🟡': '🟡 Active Skirmish',
};

let warMessageId = null;

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch(); // Ensure the channel cache is populated

    const botCommands = guild.channels.cache.get(process.env.BOT_COMMANDS_CHANNEL_ID);
    const warChannel = guild.channels.cache.get(process.env.WAR_TIME_CHANNEL_ID);

    if (!botCommands || !warChannel) {
      console.error('❌ Required channels not found by ID.');
      return;
    }

    console.log('📢 Sending war status message...');
    const warMessage = await botCommands.send({
      content: `🛡️ **Alliance War Status**\n\n🔵 = No War\n🟢 = Active War\n🟡 = Active Skirmish\n🔴 = Emergency Need Everyone`,
    });

    warMessageId = warMessage.id;

    for (const emoji of ['🔵', '🟢', '🟡', '🔴']) {
      await warMessage.react(emoji);
    }

    console.log('✅ War status message sent and reactions added.');

  } catch (error) {
    console.error('❌ Failed during ready event:', error.message || error);
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
    if (!newName) return;

    const guild = reaction.message.guild;
    await guild.channels.fetch(); // Ensure updated channel cache

    const warChannel = guild.channels.cache.get(process.env.WAR_TIME_CHANNEL_ID);
    if (!warChannel) {
      console.error('❌ war-time channel not found by ID.');
      await reaction.users.remove(user.id);
      return;
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('⏰ Rename timed out after 15 seconds.')), 15000)
    );

    await Promise.race([
      warChannel.setName(newName),
      timeoutPromise
    ]);

    console.log(`✏️ Renamed war-time to ${newName}`);

  } catch (err) {
    console.error('❌ Reaction handling failed or timed out:', err.message || err);
  } finally {
    try {
      await reaction.users.remove(user.id);
    } catch (e) {
      console.error('⚠️ Failed to remove reaction:', e.message || e);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
