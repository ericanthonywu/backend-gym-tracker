exports.up = async function (knex) {
  // Drop meal tables
  await knex.schema.dropTableIfExists('meal_logs');
  await knex.schema.dropTableIfExists('meal_settings');

  // Create menstruation logs table
  await knex.schema.createTable('menstruation_logs', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').nullable();
    table.string('flow_intensity').nullable(); // e.g. 'Light', 'Medium', 'Heavy'
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('menstruation_logs');

  // Re-create meal tables (basic structure to allow rollback)
  await knex.schema.createTable('meal_settings', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable();
    table.string('name').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('meal_logs', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable();
    table.uuid('meal_setting_id').references('id').inTable('meal_settings').onDelete('CASCADE');
    table.date('logged_date').notNullable();
    table.boolean('is_checked').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};
