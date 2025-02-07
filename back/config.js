module.exports = {
  koneksi: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    dbname: process.env.DB_DBNAME,
    port: process.env.DB_PORT,
    dialect: "mysql",
  },
};
