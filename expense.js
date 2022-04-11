require("dotenv").config();

const Airtable = require("airtable");
Airtable.configure({
  endpointUrl: "https://api.airtable.com",
  apiKey: process.env.AIRTABLE_KEY,
});

const base = Airtable.base(process.env.AIRTABLE_BASE);

const ExpenseCategories = {
  f: { title: "food", emoji: "🍛" },
  t: { title: "transport", emoji: "🚎" },
  s: { title: "shopping", emoji: "🛍" },
  o: { title: "other", emoji: "⚡️" },
  i: { title: "income", emoji: "💰" },
};

const saveExpense = (amount, category) => {
  const Category = ExpenseCategories[category].title;
  const newRecords = [
    {
      fields: {
        Datetime: new Date(),
        Amount: amount,
        Category,
      },
    },
  ];

  return new Promise((resolve, reject) => {
    base("Table").create(newRecords, (err, records) => {
      if (err) {
        reject(err);
      }
      resolve(records);
    });
  });
};

module.exports = {
  ExpenseCategories,
  saveExpense,
};
