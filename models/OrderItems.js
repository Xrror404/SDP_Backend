"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class OrderItems extends Model {
    static associate(models) {
      // Definisi relasi
      OrderItems.belongsTo(models.orders, {
        foreignKey: 'order_id',
        targetKey: 'order_id',
        as: 'order'
      });
      OrderItems.belongsTo(models.produk, {
        foreignKey: 'product_title',
        targetKey: 'title',
        as: 'product'
      });
    }
  }

  OrderItems.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    order_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'orders',
        key: 'order_id'
      }
    },
    product_title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      references: {
        model: 'produk',
        key: 'title'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: "order_items",
    tableName: "order_items",
    timestamps: false
  });

  return OrderItems;
}; 