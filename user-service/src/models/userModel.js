import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Vui lòng nhập tên người dùng'],
        },
        email: {
            type: String,
            required: [true, 'Vui lòng nhập email'],
            unique: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: [true, 'Vui lòng nhập mật khẩu'],
            // Thêm ràng buộc tối thiểu 4 ký tự
            minlength: [4, 'Mật khẩu phải có ít nhất 4 ký tự'],
        },
        isAdmin: {
            type: Boolean,
            required: true,
            default: false,
        },
        branchId: {
            type: String,
            default: null,
        },
        phone: {
            type: String,
            required: false,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

// Phương thức kiểm tra mật khẩu
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Middleware: Tự động mã hóa mật khẩu trước khi lưu
userSchema.pre('save', async function (next) {
    // Nếu mật khẩu không thay đổi thì bỏ qua
    if (!this.isModified('password')) {
        return next();
    }

    // Lưu ý quan trọng: Mongoose kiểm tra minlength TRƯỚC khi chạy middleware 'save'.
    // Vì vậy, password ở đây đã đảm bảo > 4 ký tự thô mới bắt đầu hash.
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model('User', userSchema);
export default User;