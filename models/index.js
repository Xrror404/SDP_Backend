const db = {};
const Pengguna = require("./Pengguna");
const Produk = require("./Produk");
const Orders = require("./Orders");
const OrderItems = require("./OrderItems");
const conn = require("../connection");
const { DataTypes } = require("sequelize");

// Inisialisasi model
db.pengguna = Pengguna(conn, DataTypes);
db.produk = Produk(conn, DataTypes);
db.orders = Orders(conn, DataTypes);
db.order_items = OrderItems(conn, DataTypes);

// Menjalankan fungsi associate untuk setiap model
Object.values(db).forEach((model) => {
  if (model.associate) {
    model.associate(db);
  }
});

module.exports = db;
