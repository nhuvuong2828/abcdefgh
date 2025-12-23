import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import axios from 'axios';
import Drone from './src/models/droneModel.js'; // Đảm bảo đường dẫn model đúng

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// --- 1. CẤU HÌNH DATABASE ---
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/foodfast-db');
        console.log('✅ Drone Service DB Connected');
    } catch (err) {
        console.error('❌ DB Connection Error:', err);
    }
};
connectDB();

// --- 2. CẤU HÌNH SOCKET.IO ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware để dùng io trong route (nếu cần mở rộng sau này)
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- 3. CÁC CONST & URL ---
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';

// Tọa độ giả lập (Demo: Từ Dinh Độc Lập -> Chợ Bến Thành)
// Trong thực tế: Bạn sẽ truyền tọa độ này từ Frontend lên API /start-delivery
const RESTAURANT_LOC = { lat: 10.7769, lng: 106.7009 };
const CUSTOMER_LOC = { lat: 10.7626, lng: 106.6602 };

// --- 4. HÀM TIỆN ÍCH TÍNH KHOẢNG CÁCH (Haversine Formula) ---
const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
}

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Bán kính trái đất (km)
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

// --- 5. HÀM MÔ PHỎNG DI CHUYỂN (CORE LOGIC) ---
const simulateDelivery = (drone, orderId) => {
    // A. Tính tổng quãng đường trước khi bay
    const totalDistanceKm = getDistanceFromLatLonInKm(
        RESTAURANT_LOC.lat, RESTAURANT_LOC.lng,
        CUSTOMER_LOC.lat, CUSTOMER_LOC.lng
    );

    console.log(`🚁 [SIMULATION] Drone ${drone.name} xuất phát. Tổng hành trình: ${totalDistanceKm.toFixed(2)} km`);

    let progress = 0; // 0.0 -> 1.0
    const step = 0.05; // 5% mỗi lần cập nhật (Tốc độ bay)

    const flightInterval = setInterval(async () => {
        progress += step;

        // B. Tính tọa độ hiện tại (Nội suy tuyến tính)
        const currentLat = RESTAURANT_LOC.lat + (CUSTOMER_LOC.lat - RESTAURANT_LOC.lat) * progress;
        const currentLng = RESTAURANT_LOC.lng + (CUSTOMER_LOC.lng - RESTAURANT_LOC.lng) * progress;

        // C. Tính toán thông số quãng đường
        const distanceTraveled = (totalDistanceKm * progress).toFixed(2);
        const distanceRemaining = Math.max(0, totalDistanceKm - distanceTraveled).toFixed(2);

        // D. Xác định thông báo trạng thái
        let statusMessage = `Đang di chuyển đến vị trí của bạn`;

        if (progress >= 1) {
            statusMessage = 'Đang hạ cánh xuống vị trí của bạn...';
        } else if (Math.abs(progress - 0.5) < 0.01) {
            // Logic bắt điểm 50%
            statusMessage = `Đang di chuyển đến vị trí của bạn`;
            console.log(``);
        }

        // E. Gửi dữ liệu xuống Frontend
        io.to(orderId).emit('status_update', {
            status: statusMessage,
            location: { lat: currentLat, lng: currentLng },
            droneId: drone.name,
            progress: progress.toFixed(2), // 0.05, 0.5, 1.0
            stats: {
                total: totalDistanceKm.toFixed(2) + ' km',
                traveled: distanceTraveled + ' km',
                remaining: distanceRemaining + ' km'
            }
        });

        // F. Xử lý khi đến đích (100%)
        if (progress >= 1) {
            clearInterval(flightInterval);
            console.log(`✅ [SIMULATION] Drone ${drone.name} đã hoàn thành đơn ${orderId}!`);

            try {
                // 1. Gọi API cập nhật Order Service
                await axios.put(`${ORDER_SERVICE_URL}/${orderId}/status`, { status: 'DELIVERED' });

                // 2. Gửi thông báo cuối cùng
                io.to(orderId).emit('status_update', {
                    status: 'Giao hàng thành công! Cảm ơn quý khách.',
                    location: CUSTOMER_LOC,
                    droneId: drone.name,
                    progress: 1.0,
                    stats: {
                        total: totalDistanceKm.toFixed(2) + ' km',
                        traveled: totalDistanceKm.toFixed(2) + ' km',
                        remaining: '0.00 km'
                    }
                });

                // 3. Reset Drone: Về trạng thái rảnh + Trừ Pin
                const currentDrone = await Drone.findById(drone._id);
                if (currentDrone) {
                    currentDrone.status = 'Idle';
                    currentDrone.currentOrderId = null;
                    // Giả lập trừ 10% pin mỗi chuyến
                    currentDrone.batteryLevel = Math.max(0, currentDrone.batteryLevel - 10);

                    const updatedDrone = await currentDrone.save();
                    io.emit('drone_update', updatedDrone); // Update cho Dashboard Admin
                    console.log(`-> Drone về trạm sạc. Pin còn: ${updatedDrone.batteryLevel}%`);
                }

            } catch (error) {
                console.error("❌ Lỗi khi kết thúc giao hàng:", error.message);
            }
        }
    }, 2000); // Cập nhật mỗi 2 giây
};

// --- 6. SOCKET CONNECTION ---
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Client join room theo Order ID để nhận tin riêng
    socket.on('join_order_room', (orderId) => {
        console.log(`📡 User joined tracking room: ${orderId}`);
        socket.join(orderId);
    });

    socket.on('disconnect', () => { });
});

// --- 7. API ROUTES ---

// Lấy danh sách Drone (có lọc theo chi nhánh)
app.get('/', async (req, res) => {
    try {
        const { branchId } = req.query;
        const query = branchId ? { branchId } : {};
        const drones = await Drone.find(query);
        res.json(drones);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Tạo Drone mới
app.post('/', async (req, res) => {
    try {
        const drone = await Drone.create(req.body);
        io.emit('drone_update', drone);
        res.status(201).json(drone);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Cập nhật Drone
app.put('/:id', async (req, res) => {
    try {
        const drone = await Drone.findByIdAndUpdate(req.params.id, req.body, { new: true });
        io.emit('drone_update', drone);
        res.json(drone);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Xóa Drone
app.delete('/:id', async (req, res) => {
    try {
        await Drone.findByIdAndDelete(req.params.id);
        io.emit('drone_deleted', req.params.id);
        res.json({ message: 'Drone removed' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// API ĐIỀU PHỐI GIAO HÀNG (TRIGGER SIMULATION)
app.post('/start-delivery', async (req, res) => {
    const { orderId, branchId } = req.body;
    console.log(`🚚 [API] Yêu cầu giao hàng. Order: ${orderId}, Branch: ${branchId}`);

    if (!orderId || !branchId) return res.status(400).json({ message: "Thiếu dữ liệu đầu vào" });

    try {
        // Tìm Drone rảnh & còn pin (>20%)
        const availableDrone = await Drone.findOne({
            branchId: branchId,
            status: 'Idle',
            batteryLevel: { $gt: 20 }
        });

        if (!availableDrone) {
            return res.status(404).json({ message: "Không có Drone khả dụng hoặc pin yếu" });
        }

        // Cập nhật trạng thái Drone -> Delivering
        availableDrone.status = 'Delivering';
        availableDrone.currentOrderId = orderId;
        const savedDrone = await availableDrone.save();

        // Báo cho Admin Dashboard
        io.emit('drone_update', savedDrone);

        // Gọi Order Service cập nhật trạng thái đơn hàng (Không await để tránh block)
        axios.put(`${ORDER_SERVICE_URL}/${orderId}/status`, {
            status: 'SHIPPING',
            droneId: savedDrone.name
        }).catch(e => console.error("⚠️ Lỗi gọi Order Service:", e.message));

        // BẮT ĐẦU MÔ PHỎNG BAY
        simulateDelivery(savedDrone, orderId);

        res.json({
            message: "Đã điều phối Drone thành công",
            drone: savedDrone
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// --- 8. KHỞI CHẠY SERVER ---
const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
    console.log(`🚀 Drone Delivery Service running on port ${PORT}`);
});