require('dotenv').config();

module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres', 
    logging: false,
    // 🚨 FIX: ADD SSL configuration to DEVELOPMENT environment
    dialectOptions: {
      ssl: {
        require: true,
        // This is often required when connecting from a client to a service like Neon/Render DB
        rejectUnauthorized: false 
      }
    }
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  }
};