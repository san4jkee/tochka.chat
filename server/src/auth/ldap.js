const ldap = require('ldapjs');
const config = require('../config');

function createLdapClient() {
  const client = ldap.createClient({
    url: config.ldap.url,
    tlsOptions: config.ldap.tlsOptions
  });

  return new Promise((resolve, reject) => {
    client.on('error', (err) => {
      reject(err);
    });

    client.bind(config.ldap.bindDN, config.ldap.bindPassword, (err) => {
      if (err) {
        client.destroy();
        reject(err);
      } else {
        resolve(client);
      }
    });
  });
}

async function authenticateWithAD(username, password) {
  let client;
  try {
    client = await createLdapClient();

    const searchFilter = config.ldap.searchFilter.replace('{{username}}', username);

    const result = await new Promise((resolve, reject) => {
      client.search(config.ldap.searchBase, {
        filter: searchFilter,
        scope: 'sub',
        attributes: ['dn', 'cn', 'mail', 'sAMAccountName', 'memberOf', 'department', 'title', 'displayName']
      }, (err, res) => {
        if (err) return reject(err);

        const entries = [];
        res.on('searchEntry', (entry) => {
          entries.push(entry);
        });
        res.on('error', (err) => reject(err));
        res.on('end', () => resolve(entries));
      });
    });

    if (result.length === 0) {
      throw new Error('User not found in Active Directory');
    }

    const userEntry = result[0];
    const userDn = userEntry.dn.toString();
    const userAttributes = {};
    userEntry.attributes.forEach((attr) => {
      userAttributes[attr.type] = attr.values.length === 1 ? attr.values[0] : attr.values;
    });

    await new Promise((resolve, reject) => {
      client.bind(userDn, password, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    let groups = [];
    if (userAttributes.memberOf) {
      const memberOf = Array.isArray(userAttributes.memberOf) ? userAttributes.memberOf : [userAttributes.memberOf];
      groups = memberOf.map(g => {
        const cn = g.match(/CN=([^,]+)/);
        return cn ? cn[1] : g;
      });
    }

    return {
      username: userAttributes.sAMAccountName || username,
      displayName: userAttributes.displayName || userAttributes.cn || username,
      email: userAttributes.mail || `${username}@${config.ldap.searchBase.replace('DC=', '').replace(/,/g, '.').toLowerCase()}`,
      department: userAttributes.department || '',
      roles: groups,
      adSynced: true
    };
  } finally {
    if (client) {
      client.unbind();
      client.destroy();
    }
  }
}

module.exports = { authenticateWithAD };
