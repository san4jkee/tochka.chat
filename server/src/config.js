require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  pg: {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'messenger'
  },
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  ldap: {
    url: process.env.LDAP_URL || 'ldap://your-ad-server:389',
    bindDN: process.env.LDAP_BIND_DN || 'CN=ServiceAccount,OU=Users,DC=example,DC=com',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    searchBase: process.env.LDAP_SEARCH_BASE || 'DC=example,DC=com',
    searchFilter: process.env.LDAP_SEARCH_FILTER || '(sAMAccountName={{username}})',
    tlsOptions: {
      rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false'
    }
  },
  upload: {
    maxSize: 10 * 1024 * 1024,
    dir: 'uploads'
  }
};
