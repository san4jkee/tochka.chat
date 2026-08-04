const knex = require('knex');
const config = require('../config');

const db = knex({
  client: 'pg',
  connection: {
    host: config.pg.host,
    port: config.pg.port,
    user: config.pg.user,
    password: config.pg.password,
    database: config.pg.database
  },
  pool: {
    min: 2,
    max: 10
  }
});

module.exports = db;
