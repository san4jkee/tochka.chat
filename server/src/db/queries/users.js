const db = require('../index');

const USER_COLUMNS = [
  'id', 'username', 'display_name', 'email', 'password', 'avatar',
  'status', 'last_seen', 'ad_synced', 'roles', 'department',
  'created_at', 'updated_at'
];

const USER_PUBLIC = [
  'id', 'username', 'display_name', 'email', 'avatar',
  'status', 'department', 'last_seen', 'created_at', 'updated_at'
];

async function findById(id) {
  return db('users').where('id', id).first();
}

async function findByUsername(username) {
  return db('users').where('username', username).first();
}

async function findByUsernameOrEmail(username, email) {
  return db('users').where('username', username).orWhere('email', email).first();
}

async function create(data) {
  const [user] = await db('users').insert(data).returning(USER_COLUMNS);
  return user;
}

async function upsertByUsername(data) {
  const existing = await findByUsername(data.username);
  if (existing) {
    console.log('upsertByUsername existing:', { id: existing.id, email: existing.email });
    const [updated] = await db('users')
      .where('id', existing.id)
      .update({ ...data, updated_at: db.fn.now() })
      .returning(USER_COLUMNS);
    console.log('upsertByUsername result:', { email: updated?.email });
    return updated;
  }
  console.log('upsertByUsername creating new user:', { username: data.username, email: data.email });
  return create(data);
}

async function updateById(id, data) {
  console.log('updateById:', { id, data });
  const [updated] = await db('users')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() })
    .returning(USER_COLUMNS);
  console.log('updateById result:', { email: updated?.email });
  return updated;
}

async function findAllExcept(userId) {
  return db('users')
    .whereNot('id', userId)
    .select(...USER_PUBLIC)
    .orderBy('display_name');
}

module.exports = {
  USER_COLUMNS,
  USER_PUBLIC,
  findById,
  findByUsername,
  findByUsernameOrEmail,
  create,
  upsertByUsername,
  updateById,
  findAllExcept
};
