require('dotenv').config();
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is alive and well!'));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// Debug environment
console.log('🔍 ENV CHECK:',
  'DISCORD_TOKEN', process.env.DISCORD_TOKEN ? '✅' : '❌',
  'GUILD_ID', process.env.GUILD_ID ? '✅' : '❌',
  'BOT_COMMANDS_CHANNEL_ID', process.env.BOT_COMMANDS_CHANNEL_ID ? '✅' : '❌',
  'WAR_TIME_CHANNEL_ID', process.env.WAR_TIME_CHANNEL_ID ? '✅' : '❌'
);

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
  '🔴': '🔴-emergency',
  '🟢': '🟢-active-war',
  '🔵': '🔵-no-war',
  '🟡': '🟡-active-skirmish',
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
  console.log('✅ War status message sent.');
  return warMessage.id;
}

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(err => {
    console.error('❌ Error fetching guild:', err);
    return null;
  });
  if (!guild) return;

  const warChannel = guild.channels.cache.get(process.env.WAR_TIME_CHANNEL_ID);
  if (!warChannel) {
    console.error('❌ war-time channel not found.');
    return;
  }

  warMessageId = await sendWarMessage(guild);

  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('resetwarbot')
      .setDescription('Reset the war status message and reactions.')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('stopwarbot')
      .setDescription('Stop the war bot cleanly.')
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
    console.log('✅ Slash commands /resetwarbot and /stopwarbot registered.');
  } catch (error) {
    console.error('❌ Slash command registration failed:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guild = interaction.guild;
  const botCommands = guild.channels.cache.get(process.env.BOT_COMMANDS_CHANNEL_ID);
  if (!botCommands) {
    return interaction.reply({ content: '❌ Cannot find bot-commands channel.', flags: 64 });
  }

  if (interaction.commandName === 'resetwarbot') {
    try {
      const fetched = await botCommands.messages.fetch({ limit: 10 });
      const oldMsg = fetched.find(m => m.id === warMessageId);
      if (oldMsg) {
        await oldMsg.delete();
        console.log('🗑️ Deleted old war status message.');
      }
      warMessageId = await sendWarMessage(guild);
      return interaction.reply({ content: '♻️ War status reset.', flags: 64 });
    } catch (err) {
      console.error('❌ Reset failed:', err);
      return interaction.reply({ content: '❌ Failed to reset war status.', flags: 64 });
    }
  }

  if (interaction.commandName === 'stopwarbot') {
    await interaction.reply({ content: '🛑 Stopping War Bot now...', flags: 64 });
    console.log('🛑 Stop command received. Logging out...');
    await client.destroy();
    console.log('👋 Bot logged out, exiting process.');
    process.exit(0);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.message.id !== warMessageId) return;

    const newName = EMOJI_TO_NAME[reaction.emoji.name];
    if (!newName) {
      console.log('⚠️ Unknown emoji reaction:', reaction.emoji.name);
      return;
    }

    const warChannel = reaction.message.guild.channels.cache.get(process.env.WAR_TIME_CHANNEL_ID);
    if (!warChannel) {
      console.error('❌ war-time channel missing.');
      await reaction.users.remove(user.id);
      return;
    }

    try {
      await warChannel.setName(newName);
      console.log(`✏️ Renamed #${warChannel.name} to "${newName}"`);
    } catch (renameError) {
      console.error('❌ Failed to rename channel:', renameError);
    }
  } catch (err) {
    console.error('❌ Reaction processing error:', err);
  } finally {
    try {
      await reaction.users.remove(user.id);
    } catch (removeErr) {
      console.error('⚠️ Unable to remove reaction:', removeErr);
    }
  }
});

// Login and error catching
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('✅ Bot login successful'))
  .catch(err => {
    console.error('❌ Bot login failed:', err);
    process.exit(1);
  });

client.on('error', err => console.error('❌ Client error:', err));
process.on('unhandledRejection', err => console.error('❌ Unhandled Promise Rejection:', err));
