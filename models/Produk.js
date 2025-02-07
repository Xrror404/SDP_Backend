"use strict";
const { Model } = require("sequelize");
// Di file model Produk
module.exports = (sequelize, DataTypes) => {
  const Produk = sequelize.define("produk", {
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: true
    },
    price: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    freezeTableName: true, // Mencegah Sequelize menambahkan 's' di akhir nama tabel
    timestamps: false,  // Menghapus createdAt dan updatedAt
    id: false // Menghapus kolom id otomatis
  });
  return Produk;
};