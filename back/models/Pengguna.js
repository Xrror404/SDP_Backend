"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Pengguna extends Model {
    static associate(models) {}
  }
  Pengguna.init(
    {
      username: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false
      },
      nama_user: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      roles: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
    },
    {
      sequelize,
      modelName: "pengguna",
      tableName: "pengguna",
      paranoid: false,
      timestamps: false,
    }
  );
  return Pengguna;
};
