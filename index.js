require('dotenv').config();

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const Calendar = require('./calendar');
const chrono = require('chrono-node');

const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.context.db = {
  newAppointment: {},
};

bot.start(ctx => ctx.reply('Hello!'));

bot.on('callback_query', ctx => {
  const { callback_query } = ctx.update;
  const { id: userId } = callback_query.from;

  if (!callback_query) {
    ctx.reply('Sorry!');
  }
  const data = callback_query.data;

  if (data == 'create_appointment') {
    const { title, startedAt, endedAt } = bot.context.db.newAppointment[userId];
    ctx.reply('Wait a sec');
    Calendar.createAppointment(title, startedAt, endedAt)
      .then(() => {
        ctx.reply(
          `✅ ${title} - ${startedAt.format('ddd, D MMM - hh:mm a')} saved`,
        );
        bot.context.db.newAppointment[`${userId}`] = undefined;
      })
      .catch(error => {
        ctx.reply(error.message);
      });
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

bot.on('message', ctx => {
  const { id: userId } = ctx.message.from;
  const incoming = ctx.message.text.trim();
  const newAppointment = textToAppointments(incoming);

  if (!newAppointment) {
    ctx.reply('Please try again!');
  }

  bot.context.db.newAppointment[`${userId}`] = newAppointment;

  ctx.reply(
    `📒 ${newAppointment.title} - ${newAppointment.startedAt.format(
      'ddd, D MMM - hh:mm a',
    )}?`,
    Markup.inlineKeyboard([
      Markup.button.callback('Confirm', 'create_appointment'),
    ]),
  );
});

bot.launch();
console.log('Bot is ready!');