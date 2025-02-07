const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
const port = 3000;
require("dotenv").config();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true
}));

const jwt = require("jsonwebtoken");
const { pengguna: Pengguna, produk: Produk, orders: Orders, order_items: OrderItems } = require("./models");
const { Op } = require("sequelize");

// Fungsi untuk memformat harga rupiah
function formatRupiah(angka) {
  return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

app.post("/register", async (req, res) => {
  const { username, nama, password } = req.body;
  if (!username || !password || !nama) {
    return res.status(400).json({ msg: "silakan diisi dlu!" });
  }
  const usernamekembar = await Pengguna.findByPk(username);
  if (usernamekembar) {
    return res.status(400).json({ msg: "username gk bole kembar" });
  }
  const result = await Pengguna.create({
    username: username,
    nama_user: nama,
    password: password,
    roles: "customer",
  });
  return res.status(200).json(result);
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ msg: "masukan username & password!" });
  }
  const penggunalogin = await Pengguna.findOne({
    where: { username: username },
    attributes: ["username", "nama_user", "password", "roles"],
  });
  if (!penggunalogin) {
    return res.status(401).json({ msg: "gagal login" });
  }
  if (password === penggunalogin.password) {
    penggunalogin.password = undefined;
    const accessToken = jwt.sign(
      { penggunalogin },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "30s" }
    );
    const refreshToken = jwt.sign(
      { penggunalogin },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1d" }
    );
    
    return res
      .status(200)
      .json({ 
        msg: "berhasil login", 
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: {
          username: penggunalogin.username,
          nama: penggunalogin.nama_user,
          roles: penggunalogin.roles
        }
      });
  } else {
    return res.status(401).json({ msg: "gagal login" });
  }
});

app.post("/logout", async (req, res) => {
  return res.sendStatus(204);
});

app.get("/produk", async function (req, res) {
  try {
    const products = await Produk.findAll({
      attributes: ["title", "price", "image", "category", "qty"]
    });
    
    // Format harga sebelum dikirim ke frontend
    const formattedProducts = products.map(product => ({
      ...product.toJSON(),
      price: `Rp ${formatRupiah(product.price)}`
    }));
    
    return res.status(200).json(formattedProducts);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan saat mengambil data produk" });
  }
});

// Endpoint untuk membuat order baru
app.post("/orders", async (req, res) => {
  try {
    const { order_id, username, order_date, payment_method, total_amount, status } = req.body;
    
    // Validasi input
    if (!order_id || !username || !order_date || !payment_method || !total_amount || !status) {
      return res.status(400).json({ msg: "Semua field harus diisi!" });
    }

    // Cek apakah username valid
    const user = await Pengguna.findByPk(username);
    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan!" });
    }

    // Buat order baru
    const order = await Orders.create({
      order_id,
      username,
      order_date,
      payment_method,
      total_amount,
      status
    });

    return res.status(201).json({ 
      msg: "Order berhasil dibuat",
      order 
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan saat membuat order" });
  }
});

// Endpoint untuk menyimpan order items
app.post("/order-items", async (req, res) => {
  try {
    const { items } = req.body;
    console.log('Received items:', items); // Debug log
    
    // Validasi input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ msg: "Items tidak valid!" });
    }

    // Cek apakah order_id valid
    const order = await Orders.findByPk(items[0].order_id);
    if (!order) {
      return res.status(404).json({ msg: "Order tidak ditemukan!" });
    }

    // Proses setiap item untuk memastikan format harga benar
    const processedItems = items.map(item => ({
      order_id: item.order_id,
      product_title: item.product_title,
      quantity: item.quantity,
      price: parseFloat(item.price.replace(/[^0-9.-]+/g, "")) // Hapus "Rp" dan format lainnya
    }));

    console.log('Processed items:', processedItems); // Debug log

    // Simpan semua items
    const savedItems = await OrderItems.bulkCreate(processedItems);

    // Update stok produk
    for (const item of processedItems) {
      const produk = await Produk.findByPk(item.product_title);
      if (produk) {
        const newQty = produk.qty - item.quantity;
        if (newQty < 0) {
          throw new Error(`Stok produk ${item.product_title} tidak mencukupi`);
        }
        await produk.update({
          qty: newQty
        });
      } else {
        throw new Error(`Produk ${item.product_title} tidak ditemukan`);
      }
    }

    return res.status(201).json({
      msg: "Order items berhasil disimpan",
      items: savedItems
    });

  } catch (error) {
    console.error('Error detail:', error.message); // Debug log
    console.error('Error stack:', error.stack); // Debug log
    return res.status(500).json({ 
      msg: "Terjadi kesalahan saat menyimpan order items",
      error: error.message 
    });
  }
});

// Endpoint untuk mendapatkan daftar order berdasarkan username
app.get("/orders/:username", async (req, res) => {
  try {
    const { username } = req.params;
    
    const orders = await Orders.findAll({
      where: { username },
      include: [{
        model: OrderItems,
        as: 'items',
        include: [{
          model: Produk,
          as: 'product',
          attributes: ['title', 'image']
        }]
      }],
      order: [['order_date', 'DESC']]
    });

    // Format data sebelum dikirim ke frontend
    const formattedOrders = orders.map(order => {
      const orderData = order.toJSON();
      return {
        ...orderData,
        total_amount: `Rp ${formatRupiah(orderData.total_amount)}`,
        items: orderData.items.map(item => ({
          ...item,
          price: `Rp ${formatRupiah(item.price)}`
        }))
      };
    });

    return res.status(200).json(formattedOrders);

  } catch (error) {
    console.error('Error getting orders:', error);
    return res.status(500).json({ 
      msg: "Terjadi kesalahan saat mengambil data order",
      error: error.message 
    });
  }
});

// Endpoint untuk mendapatkan detail order items berdasarkan order_id
app.get("/order-items/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;
    console.log('Mencari order items dengan order_id:', order_id);

    // Ambil informasi order terlebih dahulu
    const order = await Orders.findOne({
      where: { order_id: order_id },
      raw: true
    });

    if (!order) {
      return res.status(404).json({ 
        msg: "Order tidak ditemukan!",
        order_id: order_id
      });
    }

    // Ambil items
    const items = await OrderItems.findAll({
      where: { order_id: order_id },
      raw: true
    });
    
    console.log('Items yang ditemukan:', items);

    // Format response
    const response = {
      order: {
        order_id: order.order_id,
        username: order.username,
        order_date: order.order_date,
        payment_method: order.payment_method,
        total_amount: `Rp ${formatRupiah(order.total_amount * 1000)}`,
        status: order.status
      },
      items: items.length > 0 ? items.map(item => ({
        id: item.id,
        order_id: item.order_id,
        product_title: item.product_title,
        quantity: item.quantity,
        price: `Rp ${formatRupiah(item.price * 1000)}`,
        subtotal: `Rp ${formatRupiah(item.price * item.quantity * 1000)}`
      })) : [],
      message: items.length === 0 ? "Order ini tidak memiliki items" : undefined
    };

    // Kembalikan response dengan status 200 meskipun tidak ada items
    return res.status(200).json(response);

  } catch (error) {
    console.error('Error getting order items:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      msg: "Terjadi kesalahan saat mengambil detail order items",
      error: error.message
    });
  }
});

// Endpoint untuk mendapatkan semua order dan items berdasarkan username
app.get("/orders-with-items/:username", async (req, res) => {
  try {
    const { username } = req.params;
    
    const orders = await Orders.findAll({
      where: { username },
      attributes: ['order_id', 'username', 'order_date', 'payment_method', 'total_amount', 'status'],
      include: [{
        model: OrderItems,
        as: 'items',
        include: [{
          model: Produk,
          as: 'product',
          attributes: ['title', 'image', 'category']
        }]
      }],
      order: [['order_date', 'DESC']]
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        msg: "Tidak ada order ditemukan untuk username ini",
        username: username
      });
    }

    // Format data
    const formattedOrders = orders.map(order => {
      const orderData = order.toJSON();
      return {
        order_id: orderData.order_id,
        username: orderData.username,
        order_date: orderData.order_date,
        payment_method: orderData.payment_method,
        total_amount: `Rp ${formatRupiah(orderData.total_amount)}`,
        status: orderData.status,
        items: orderData.items.map(item => ({
          id: item.id,
          product_title: item.product_title,
          quantity: item.quantity,
          price: `Rp ${formatRupiah(item.price)}`,
          subtotal: `Rp ${formatRupiah(item.price * item.quantity)}`,
          product: item.product ? {
            title: item.product.title,
            image: item.product.image,
            category: item.product.category
          } : null
        }))
      };
    });

    return res.status(200).json({
      username: username,
      total_orders: orders.length,
      orders: formattedOrders
    });

  } catch (error) {
    console.error('Error getting orders with items:', error);
    return res.status(500).json({ 
      msg: "Terjadi kesalahan saat mengambil data order",
      error: error.message 
    });
  }
});

// Middleware untuk verifikasi admin
const verifyAdmin = async (req, res, next) => {
  try {
    const username = req.params.username || req.query.username || req.headers['x-username'];
    console.log('Verifying admin for username:', username);

    if (!username) {
      return res.status(401).json({ msg: "Username tidak ditemukan" });
    }

    const user = await Pengguna.findOne({
      where: { username },
      attributes: ['roles']
    });

    console.log('User found:', user);

    if (!user || user.roles !== 'admin') {
      return res.status(403).json({ msg: "Akses ditolak! Hanya untuk admin" });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Error verifying admin:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan saat verifikasi admin" });
  }
};

// Endpoint untuk mengecek role user
app.get("/check-role/:username", async (req, res) => {
  try {
    const { username } = req.params;
    console.log('Checking role for username:', username);

    const user = await Pengguna.findOne({
      where: { username },
      attributes: ['username', 'roles', 'nama_user']
    });

    console.log('User found:', user);

    if (!user) {
      return res.status(404).json({ 
        msg: "User tidak ditemukan",
        username: username 
      });
    }

    return res.status(200).json({ 
      roles: user.roles,
      username: user.username,
      nama: user.nama_user
    });
  } catch (error) {
    console.error('Error checking role:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan saat mengecek role" });
  }
});

// Endpoint untuk mengubah role user menjadi admin
app.post("/make-admin/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const user = await Pengguna.findOne({ where: { username } });
    
    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan" });
    }

    await user.update({ roles: "admin" });
    
    return res.status(200).json({ 
      msg: "User berhasil dijadikan admin",
      user: {
        username: user.username,
        roles: user.roles
      }
    });
  } catch (error) {
    console.error('Error making admin:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan" });
  }
});

// Group endpoint admin
app.get("/admin/orders-summary", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ambil semua order hari ini
    const todayOrders = await Orders.findAll({
      where: {
        order_date: {
          [Op.gte]: today
        }
      },
      include: [{
        model: OrderItems,
        as: 'items'
      }]
    });

    // Hitung total orders
    const totalOrders = todayOrders.length;

    // Hitung total sales (jumlah item terjual)
    const totalSales = todayOrders.reduce((acc, order) => {
      return acc + order.items.reduce((itemAcc, item) => itemAcc + item.quantity, 0);
    }, 0);

    // Hitung total revenue
    const revenue = todayOrders.reduce((acc, order) => acc + parseFloat(order.total_amount), 0);

    // Ambil new orders (status: 'Menunggu Pembayaran' atau 'Belum Diproses')
    const newOrders = await Orders.findAll({
      where: {
        status: ['Menunggu Pembayaran', 'Belum Diproses']
      },
      order: [['order_date', 'DESC']],
      limit: 10
    });

    return res.status(200).json({
      totalOrders,
      totalSales,
      revenue: revenue * 1000,
      newOrders: newOrders.map(order => ({
        ...order.toJSON(),
        total_amount: `Rp ${formatRupiah(order.total_amount * 1000)}`
      }))
    });

  } catch (error) {
    console.error('Error getting orders summary:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan saat mengambil ringkasan order" });
  }
});

app.get("/admin/popular-products", async (req, res) => {
  try {
    // Ambil 5 order terakhir dengan items dan informasi produk
    const recentOrders = await Orders.findAll({
      include: [{
        model: OrderItems,
        as: 'items',
        include: [{
          model: Produk,
          as: 'product',
          attributes: ['title', 'image', 'category', 'qty']
        }]
      }],
      order: [['order_date', 'DESC']],
      limit: 5
    });

    // Format data untuk ditampilkan
    const recentPurchases = recentOrders.map(order => {
      const orderData = order.toJSON();
      return {
        order_id: orderData.order_id,
        username: orderData.username,
        order_date: orderData.order_date,
        payment_method: orderData.payment_method,
        status: orderData.status,
        total_amount: `Rp ${formatRupiah(orderData.total_amount * 1000)}`,
        items: orderData.items.map(item => ({
          product_title: item.product_title,
          quantity: item.quantity,
          price: `Rp ${formatRupiah(item.price * 1000)}`,
          subtotal: `Rp ${formatRupiah(item.price * item.quantity * 1000)}`,
          product: item.product ? {
            title: item.product.title,
            image: item.product.image,
            category: item.product.category,
            current_stock: item.product.qty
          } : null
        }))
      };
    });

    return res.status(200).json(recentPurchases);

  } catch (error) {
    console.error('Error getting recent purchases:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan saat mengambil data pembelian terakhir" });
  }
});

app.get("/admin/notifications", async (req, res) => {
  try {
    const notifications = [];

    const newOrders = await Orders.findAll({
      where: {
        status: 'Menunggu Pembayaran',
        order_date: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    newOrders.forEach(order => {
      notifications.push({
        type: 'order',
        message: `Order baru #${order.order_id} menunggu konfirmasi`,
        timestamp: order.order_date
      });
    });

    const lowStockProducts = await Produk.findAll({
      where: {
        qty: {
          [Op.lt]: 10
        }
      }
    });

    lowStockProducts.forEach(product => {
      notifications.push({
        type: 'stock',
        message: `Stok ${product.title} hampir habis (${product.qty} tersisa)`,
        timestamp: new Date()
      });
    });

    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json(notifications);

  } catch (error) {
    console.error('Error getting notifications:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan saat mengambil notifikasi" });
  }
});

app.get("/admin/daily-activities", async (req, res) => {
  try {
    const activities = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await Orders.findAll({
      where: {
        order_date: {
          [Op.gte]: today
        }
      },
      order: [['order_date', 'DESC']]
    });

    todayOrders.forEach(order => {
      activities.push({
        title: `Order Baru #${order.order_id}`,
        description: `Order baru dari ${order.username} - ${order.payment_method}`,
        timestamp: order.order_date,
        icon: 'cart'
      });
    });

    const lowStockProducts = await Produk.findAll({
      where: {
        qty: {
          [Op.lt]: 10
        }
      }
    });

    lowStockProducts.forEach(product => {
      activities.push({
        title: 'Peringatan Stok',
        description: `Stok ${product.title} tinggal ${product.qty}`,
        timestamp: new Date(),
        icon: 'exclamation-triangle'
      });
    });

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json(activities);

  } catch (error) {
    console.error('Error getting daily activities:', error);
    return res.status(500).json({ msg: "Terjadi kesalahan saat mengambil aktivitas harian" });
  }
});

// Endpoint untuk mendapatkan history pembelian terakhir
app.get("/admin/purchase-history", async (req, res) => {
  try {
    // Ambil 5 order terakhir dengan detail items dan produk
    const recentOrders = await Orders.findAll({
      include: [{
        model: OrderItems,
        as: 'items',
        include: [{
          model: Produk,
          as: 'product',
          attributes: ['title', 'image', 'category']
        }]
      }],
      order: [['order_date', 'DESC']],
      limit: 5
    });

    if (!recentOrders || recentOrders.length === 0) {
      return res.status(200).json({
        msg: "Belum ada history pembelian",
        purchases: []
      });
    }

    // Format data untuk ditampilkan
    const purchaseHistory = recentOrders.map(order => {
      const orderData = order.toJSON();
      return {
        order_id: orderData.order_id,
        username: orderData.username,
        order_date: new Date(orderData.order_date).toLocaleString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        payment_method: orderData.payment_method,
        status: orderData.status,
        total_amount: `Rp ${formatRupiah(orderData.total_amount * 1000)}`,
        items: orderData.items.map(item => ({
          product_title: item.product_title,
          quantity: item.quantity,
          price: `Rp ${formatRupiah(item.price * 1000)}`,
          subtotal: `Rp ${formatRupiah(item.price * item.quantity * 1000)}`,
          product: item.product ? {
            title: item.product.title,
            image: item.product.image,
            category: item.product.category
          } : {
            title: item.product_title,
            image: null,
            category: 'Tidak tersedia'
          }
        }))
      };
    });

    return res.status(200).json({
      total_records: purchaseHistory.length,
      purchases: purchaseHistory
    });

  } catch (error) {
    console.error('Error getting purchase history:', error);
    return res.status(500).json({ 
      msg: "Terjadi kesalahan saat mengambil history pembelian",
      error: error.message 
    });
  }
});

// Endpoint untuk mengupdate produk
app.put("/produk/:title", async (req, res) => {
  try {
    const { title } = req.params;
    const { price, image, category, qty } = req.body;

    // Cek apakah produk ada
    const produk = await Produk.findByPk(title);
    if (!produk) {
      return res.status(404).json({ 
        msg: "Produk tidak ditemukan",
        title: title 
      });
    }

    // Update produk
    await produk.update({
      price: price,
      image: image,
      category: category,
      qty: qty
    });

    // Ambil data produk yang sudah diupdate
    const updatedProduk = await Produk.findByPk(title);

    return res.status(200).json({
      msg: "Produk berhasil diupdate",
      produk: {
        title: updatedProduk.title,
        price: `Rp ${formatRupiah(updatedProduk.price)}`,
        image: updatedProduk.image,
        category: updatedProduk.category,
        qty: updatedProduk.qty
      }
    });

  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ 
      msg: "Terjadi kesalahan saat mengupdate produk",
      error: error.message 
    });
  }
});

// Endpoint untuk menghapus produk
app.delete("/produk/:title", async (req, res) => {
  try {
    const { title } = req.params;

    // Cek apakah produk ada
    const produk = await Produk.findByPk(title);
    if (!produk) {
      return res.status(404).json({ 
        msg: "Produk tidak ditemukan",
        title: title 
      });
    }

    // Cek apakah produk pernah digunakan di order_items
    const orderItems = await OrderItems.findOne({
      where: { product_title: title }
    });

    if (orderItems) {
      return res.status(400).json({ 
        msg: "Produk tidak dapat dihapus karena sudah pernah dipesan",
        title: title 
      });
    }

    // Hapus produk
    await produk.destroy();

    return res.status(200).json({
      msg: "Produk berhasil dihapus",
      title: title
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ 
      msg: "Terjadi kesalahan saat menghapus produk",
      error: error.message 
    });
  }
});

// Endpoint untuk menambah produk baru
app.post("/produk/tambah", async (req, res) => {
  try {
    const { title, price, image, category, qty } = req.body;

    // Validasi input
    if (!title || !price || !image || !category || !qty) {
      return res.status(400).json({ 
        msg: "Semua field harus diisi!",
        fields: {
          title: !title ? "Title harus diisi" : null,
          price: !price ? "Price harus diisi" : null,
          image: !image ? "Image URL harus diisi" : null,
          category: !category ? "Category harus diisi" : null,
          qty: !qty ? "Quantity harus diisi" : null
        }
      });
    }

    // Cek apakah produk dengan title yang sama sudah ada
    const existingProduct = await Produk.findByPk(title);
    if (existingProduct) {
      return res.status(400).json({ 
        msg: "Produk dengan title tersebut sudah ada",
        title: title 
      });
    }

    // Buat produk baru
    const newProduct = await Produk.create({
      title,
      price,
      image,
      category,
      qty
    });

    return res.status(201).json({
      msg: "Produk berhasil ditambahkan",
      produk: {
        title: newProduct.title,
        price: `Rp ${formatRupiah(newProduct.price)}`,
        image: newProduct.image,
        category: newProduct.category,
        qty: newProduct.qty
      }
    });

  } catch (error) {
    console.error('Error adding product:', error);
    return res.status(500).json({ 
      msg: "Terjadi kesalahan saat menambah produk",
      error: error.message 
    });
  }
});
