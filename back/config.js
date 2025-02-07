module.exports = {
  koneksi: {
    host: process.env.SUPABASE_POSTGRES_HOST,       // Supabase Host
    username: process.env.SUPABASE_POSTGRES_USER,   // Supabase User
    password: process.env.SUPABASE_POSTGRES_PASSWORD,   // Supabase Password
    dbname: process.env.SUPABASE_POSTGRES_DATABASE,   // Supabase Database Name
    port: 5432, // PostgreSQL Default Port
    dialect: "postgres",
  },
};
