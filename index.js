require('dotenv').config();

const cron = require('node-cron');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const Calendar = require('./calendar');
const chrono = require('chrono-node');
const newAppointment = require('./users.json');

const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.context.db = {
  newAppointment,
};

cron.schedule(
  '30 22 * * *',
  async () => {
    const chatIds = Object.keys(bot.context.db.newAppointment);
    const startedAt = dayjs().tz('Asia/Singapore').add(1, 'day').startOf('day');
    const endedAt = startedAt.endOf('day');
    try {
      const message = await Calendar.getAppointments(startedAt, endedAt);
      chatIds.forEach(chatId => {
        bot.telegram.sendMessage(chatId, message);
      });
    } catch (error) {
      console.log('No Appointments');
    }
  },
  {
    scheduled: true,
    timezone: 'Asia/Singapore',
  },
);

bot.start(ctx => ctx.reply('Hello!'));

bot.on('callback_query', ctx => {
  const { callback_query } = ctx.update;
  const { id: userId } = callback_query.from;

  if (!callback_query) {
    ctx.reply('Sorry!');
    return;
  }
  const data = callback_query.data;

  if (data == 'create_appointment') {
    if (!bot.context.db.newAppointment[userId]) {
      ctx.reply('Sorry! This action is already taken');
      return;
    }
    const { title, startedAt, endedAt } = bot.context.db.newAppointment[userId];
    ctx.reply('Wait a sec');
    Calendar.createAppointment(title, startedAt, endedAt)
      .then(() => {
        const datetimeString = startedAt
          .tz('Asia/Singapore')
          .format('ddd, D MMM - hh:mm a');
        ctx.reply(`✅ ${title} - ${datetimeString} saved`);
        bot.context.db.newAppointment[`${userId}`] = null;
      })
      .catch(error => {
        ctx.reply(error.message);
        bot.context.db.newAppointment[`${userId}`] = null;
      });
  } else if (data == 'cancel') {
    ctx.reply(`Please try agian!`);
    bot.context.db.newAppointment[`${userId}`] = null;
  }
});

bot.command('tomorrow', ctx => {
  ctx.reply('Wait a sec');
  const startedAt = dayjs().tz('Asia/Singapore').add(1, 'day').startOf('day');
  const endedAt = startedAt.endOf('day');
  Calendar.getAppointments(startedAt, endedAt)
    .then(message => {
      ctx.replyWithMarkdown(message);
    })
    .catch(error => {
      ctx.reply(error.message);
    });
});

bot.command('today', ctx => {
  ctx.reply('Wait a sec');
  const startedAt = dayjs().tz('Asia/Singapore').startOf('day');
  const endedAt = startedAt.endOf('day');
  Calendar.getAppointments(startedAt, endedAt)
    .then(message => {
      ctx.replyWithMarkdown(message);
    })
    .catch(error => {
      ctx.reply(error.message);
    });
});

bot.command('weekend', ctx => {
  ctx.reply('Wait a sec');
  const startedAt = dayjs().tz('Asia/Singapore').endOf('week').startOf('day');
  const endedAt = startedAt.add(1, 'day').endOf('day');
  Calendar.getAppointments(startedAt, endedAt)
    .then(message => {
      ctx.replyWithMarkdown(message);
    })
    .catch(error => {
      ctx.reply(error.message);
    });
});

const textToAppointments = incoming => {
  const parsed = chrono.parse(incoming, { timezone: 'SGT' });
  if (!parsed || parsed.length == 0) {
    return null;
  }

  const [found] = parsed;
  const { text, start, end } = found;
  const title = incoming
    .replace(text, '')
    .trim()
    .replace(/\s(on)$/, '')
    .trim();

  const startedAt = dayjs(start.date());
  let endedAt = startedAt.add(1, 'hour');

  if (end) {
    endedAt = dayjs(end.date());
  }

  return {
    startedAt,
    endedAt,
    title,
  };
};

bot.on('message', async ctx => {
  const { id: userId } = ctx.message.from;
  const incoming = ctx.message.text.trim();
  const newAppointment = textToAppointments(incoming);

  if (!newAppointment) {
    ctx.reply('Please try again!');
    return;
  }

  bot.context.db.newAppointment[`${userId}`] = newAppointment;

  try {
    const overlapingAppointments = await Calendar.checkOverlapAppointments(
      newAppointment.startedAt,
      newAppointment.endedAt,
    );

    const datetimeString = newAppointment.startedAt
      .tz('Asia/Singapore')
      .format('ddd, D MMM - hh:mm a');

    let message = `📒 ${newAppointment.title} - ${datetimeString}?`;

    if (overlapingAppointments) {
      message = `${message}\n\n⚠️ *Warning*\n${overlapingAppointments}`;
    }

    ctx.replyWithMarkdown(
      message,
      Markup.inlineKeyboard([
        Markup.button.callback('Yes', 'create_appointment'),
        Markup.button.callback('No', 'cancel'),
      ]),
    );
  } catch (error) {
    ctx.reply(error.message);
  }
});

bot.launch();
console.log('Bot is ready!');
