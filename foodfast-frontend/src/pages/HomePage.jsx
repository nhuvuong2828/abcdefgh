// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Product from '../components/Product.jsx';
import ErrorDisplay from '../components/ErrorDisplay.jsx';
import HeroSection from '../components/HeroSection.jsx';

const HomePage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- State cho Tìm kiếm, Lọc và Sắp xếp ---
    const [searchTerm, setSearchTerm] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [sortBy, setSortBy] = useState('default');

    // --- State cho Phân trang ---
    const [currentPage, setCurrentPage] = useState(1);
    const productsPerPage = 6; // Tối đa 6 sản phẩm 1 trang

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/products`);
                setProducts(response.data);
                setError(null);
            } catch (err) {
                setError('Rất tiếc, không thể tải dữ liệu sản phẩm.');
                console.error("Fetch products error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    // Mỗi khi bộ lọc thay đổi, đưa trang hiện tại về trang 1
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, minPrice, maxPrice, sortBy]);

    // --- BƯỚC 1: LỌC VÀ SẮP XẾP DỮ LIỆU GỐC ---
    const filteredAndSorted = products
        .filter((item) => {
            const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchTerm.toLowerCase());
            const price = item.price;
            const min = minPrice ? parseFloat(minPrice) : 0;
            const max = maxPrice ? parseFloat(maxPrice) : Infinity;
            return matchSearch && price >= min && price <= max;
        })
        .sort((a, b) => {
            if (sortBy === 'price-asc') return a.price - b.price;
            if (sortBy === 'price-desc') return b.price - a.price;
            if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
            return 0;
        });

    // --- BƯỚC 2: TÍNH TOÁN PHÂN TRANG ---
    const indexOfLastProduct = currentPage * productsPerPage;
    const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
    // Cắt mảng để lấy 6 sản phẩm cho trang hiện tại
    const currentProducts = filteredAndSorted.slice(indexOfFirstProduct, indexOfLastProduct);
    const totalPages = Math.ceil(filteredAndSorted.length / productsPerPage);

    if (loading) return null;
    if (error) return <ErrorDisplay message={error} />;

    return (
        <div className="bg-white min-h-screen">
            <HeroSection />

            <div className="container mx-auto p-4 md:p-8">
                {/* Thanh công cụ tìm kiếm & lọc */}
                <div className="bg-gray-50 p-6 rounded-2xl mb-10 shadow-sm border border-gray-100">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tìm kiếm</label>
                            <input
                                type="text"
                                placeholder="Tên món ăn..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="lg:col-span-2 flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Giá từ</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                />
                            </div>
                            <span className="mb-2 text-gray-400">—</span>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Đến giá</label>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sắp xếp</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none cursor-pointer focus:ring-2 focus:ring-orange-500"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="default">Mặc định</option>
                                <option value="price-asc">Giá: Thấp đến Cao</option>
                                <option value="price-desc">Giá: Cao đến Thấp</option>
                                <option value="name-asc">Tên: A-Z</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Lưới sản phẩm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 min-h-[600px]">
                    {currentProducts.length > 0 ? (
                        currentProducts.map((product) => (
                            <Product key={product._id} product={product} />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed">
                            <p className="text-gray-500 text-lg">Không tìm thấy sản phẩm nào.</p>
                        </div>
                    )}
                </div>

                {/* --- UI PHÂN TRANG --- */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center mt-12 gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className={`px-4 py-2 rounded-lg border ${currentPage === 1 ? 'text-gray-300 border-gray-200' : 'text-orange-600 border-orange-600 hover:bg-orange-50'}`}
                        >
                            Trước
                        </button>

                        {[...Array(totalPages)].map((_, index) => (
                            <button
                                key={index + 1}
                                onClick={() => setCurrentPage(index + 1)}
                                className={`w-10 h-10 rounded-lg font-semibold transition-colors ${currentPage === index + 1
                                        ? 'bg-orange-600 text-white'
                                        : 'text-gray-600 hover:bg-orange-100'
                                    }`}
                            >
                                {index + 1}
                            </button>
                        ))}

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className={`px-4 py-2 rounded-lg border ${currentPage === totalPages ? 'text-gray-300 border-gray-200' : 'text-orange-600 border-orange-600 hover:bg-orange-50'}`}
                        >
                            Sau
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePage;