require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: process.env.PG_HOST || 'localhost',
      port: process.env.PG_PORT || 5432,
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      database: process.env.PG_DATABASE || 'messenger'
    },
    migrations: {
      directory: './src/db/migrations'
    },
    pool: {
      min: 2,
      max: 10
    }
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './src/db/migrations'
    },
    pool: {
      min: 2,
      max: 20
    }
  }
};
