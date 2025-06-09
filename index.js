require('dotenv').config();
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is alive and well!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// Debug .env
console.log('🔍 Environment Check:');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '✅ Loaded' : '❌ MISSING');
console.log('GUILD_ID:', process.env.GUILD_ID ? '✅ Loaded' : '❌ MISSING');
console.log('BOT_COMMANDS_CHANNEL_ID:', process.env.BOT_COMMANDS_CHANNEL_ID ? '✅ Loaded' : '❌ MISSING');
console.log('WAR_TIME_CHANNEL_ID:', process.env.WAR_TIME_CHANNEL_ID ? '✅ Loaded' : '❌ MISSING');

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
  '🔴': '🔴 Emergency Need everyone',
  '🔵': '🔵 No War',
  '🟢': '🟢 Active War',
  '🟡': '🟡 Active Skirmish',
};

let warMessageId = null;

async function sendWarMessage(guild) {
  const botCommands = guild.channels.cache.get(process.env.BOT_COMMANDS_CHANNEL_ID);
  if (!botCommands) {
    console.error('❌ bot-commands channel not found.');
    return null;
  }

  const warMessage = await botCommands.send({
    content: `🛡️ **Alliance War Status**\n\n🔵 = No War\n🟢 = Active War\n🟡 = Active Skirmish\n🔴 = Emergency Need Everyone`,
  });

  for (const emoji of ['🔵', '🟢', '🟡', '🔴']) {
    await warMessage.react(emoji);
    console.log(`✅ Reacted with ${emoji}`);
  }

  console.log('✅ War status message sent and reactions added.');
  return warMessage.id;
}

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(err => {
    console.error('❌ Failed to fetch guild:', err);
    return null;
  });
  if (!guild) return;

  const warChannel = guild.channels.cache.get(process.env.WAR_TIME_CHANNEL_ID);
  if (!warChannel) {
    console.error('❌ war-time channel not found.');
    return;
  }

  warMessageId = await sendWarMessage(guild);

  // Register slash command
  const commands = [
    new SlashCommandBuilder()
      .setName('resetwarbot')
      .setDescription('Reset the war status message and reactions.')
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, guild.id),
      { body: commands }
    );
    console.log('✅ Slash command registered: /resetwarbot');
  } catch (error) {
    console.error('❌ Failed to register slash command:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'resetwarbot') {
    const guild = interaction.guild;
    const botCommands = guild.channels.cache.get(process.env.BOT_COMMANDS_CHANNEL_ID);

    if (!botCommands) {
      await interaction.reply({ content: '❌ Cannot find bot-commands channel.', ephemeral: true });
      return;
    }

    try {
      const fetchedMessages = await botCommands.messages.fetch({ limit: 10 });
      const oldWarMsg = fetchedMessages.find(msg => msg.id === warMessageId);
      if (oldWarMsg) {
        await oldWarMsg.delete();
        console.log('🗑️ Old war message deleted.');
      }

      warMessageId = await sendWarMessage(guild);
      await interaction.reply({ content: '♻️ War status message has been reset.', ephemeral: true });
    } catch (err) {
      console.error('❌ Failed to reset war message:', err.message || err);
      await interaction.reply({ content: '❌ Failed to reset war message.', ephemeral: true });
    }
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

// 🛡️ Final catch for login
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('✅ Bot login successful'))
  .catch(err => {
    console.error('❌ Bot login failed:', err);
    process.exit(1); // force restart to show logs
  });

// Catch crashes
client.on('error', err => console.error('❌ Discord client error:', err));
process.on('unhandledRejection', err => console.error('❌ Unhandled Promise Rejection:', err));
