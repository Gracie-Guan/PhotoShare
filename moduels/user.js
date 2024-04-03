const knex = require("knex");
const dotenv =  require("dotenv");

dotenv.config();

const db = knex({
  client:'',
  connection:{

  },
});

