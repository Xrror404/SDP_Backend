"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Orders extends Model {
    static associate(models) {
      // Definisi relasi
      Orders.belongsTo(models.pengguna, {
        foreignKey: 'username',
        targetKey: 'username'
      });
      Orders.hasMany(models.order_items, {
        foreignKey: 'order_id',
        sourceKey: 'order_id',
        as: 'items'
      });
    }
  }

  Orders.init({
    order_id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: {
        model: 'pengguna',
        key: 'username'
      }
    },
    order_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    payment_method: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    total_amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: "orders",
    tableName: "orders",
    timestamps: false
  });

  return Orders;
}; 