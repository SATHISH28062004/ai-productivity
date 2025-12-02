const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://task_user:task_pass@localhost:5432/taskdb', {
  dialect: 'postgres',
  logging: false,
});

const User = sequelize.define('User', {
  email: { type: DataTypes.STRING, unique: true },
  password: DataTypes.STRING,
});

const Task = sequelize.define('Task', {
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
  category: DataTypes.STRING, // "Work", "Personal"
  priority: DataTypes.STRING, // "Low","Medium","High"
  estimated_time_hours: DataTypes.FLOAT,
  due_date: DataTypes.DATE,
  completed: { type: DataTypes.BOOLEAN, defaultValue: false },
});

User.hasMany(Task);
Task.belongsTo(User);

module.exports = { sequelize, User, Task };
