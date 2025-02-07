const Sequilize = require("sequelize");
const config = require("./config");

const { host, username, password, dbname, dialect, port } = config.koneksi;
const connection = new Sequilize(dbname, username, password, {
  host: host,
  port: port,
  dialect: dialect,
});

module.exports = connection;
