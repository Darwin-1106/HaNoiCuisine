// Seed the database with sample data and an admin account for local development
import { PrismaClient, TimeSlot, Difficulty } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { requireEnv } from '../src/lib/env.js';

try {
    process.loadEnvFile();
} catch {
    // no .env file: use existing environment variables
}

const prisma = new PrismaClient();

async function main() {
    const adminEmail = requireEnv('SEED_ADMIN_EMAIL');
    const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');

    // 1. Quận
    const districts = [
        { name: 'Hoàn Kiếm', slug: 'hoan-kiem' },
        { name: 'Hai Bà Trưng', slug: 'hai-ba-trung' },
        { name: 'Ba Đình', slug: 'ba-dinh' },
        { name: 'Đống Đa', slug: 'dong-da' },
    ];
    for (const d of districts) {
        await prisma.district.upsert({ where: { slug: d.slug }, update: {}, create: d });
    }

    // 2. Mùa
    const seasons = [
        { name: 'Xuân', slug: 'xuan' },
        { name: 'Hạ', slug: 'ha' },
        { name: 'Thu', slug: 'thu' },
        { name: 'Đông', slug: 'dong' },
    ];
    for (const s of seasons) {
        await prisma.season.upsert({ where: { slug: s.slug }, update: {}, create: s });
    }

    // 3. Món ăn (kèm mùa ngon nhất)
    const dishes = [
        { name: 'Phở bò', slug: 'pho-bo', description: 'Món nước đặc trưng của Hà Nội với nước dùng hầm xương trong và ngọt.', season: 'dong', months: '10-2' },
        { name: 'Bún chả', slug: 'bun-cha', description: 'Chả nướng than hoa ăn kèm bún, rau sống và nước chấm chua ngọt.', season: 'ha', months: '5-8' },
        { name: 'Chả cá', slug: 'cha-ca', description: 'Cá lăng áp chảo với nghệ, thì là, ăn cùng bún và mắm tôm.', season: 'dong', months: '10-2' },
        { name: 'Bánh cuốn', slug: 'banh-cuon', description: 'Lớp bánh gạo mỏng cuốn nhân thịt, mộc nhĩ, ăn với chả và nước chấm.', season: 'xuan', months: '2-4' },
        { name: 'Cà phê trứng', slug: 'ca-phe-trung', description: 'Cà phê pha lòng đỏ trứng đánh bông, béo ngậy.', season: 'dong', months: '10-2' },
        { name: 'Cốm làng Vòng', slug: 'com-lang-vong', description: 'Cốm xanh dẻo thơm, đặc sản mùa thu Hà Nội.', season: 'thu', months: '8-10' },
    ];
    for (const d of dishes) {
        const dish = await prisma.dish.upsert({
            where: { slug: d.slug },
            update: {},
            create: { name: d.name, slug: d.slug, description: d.description },
        });
        const season = await prisma.season.findUniqueOrThrow({ where: { slug: d.season } });
        await prisma.dishSeason.upsert({
            where: { dishId_seasonId: { dishId: dish.id, seasonId: season.id } },
            update: {},
            create: { dishId: dish.id, seasonId: season.id, bestMonths: d.months },
        });
    }

    // 4. Quán ăn (DỮ LIỆU MẪU - kiểm tra lại địa chỉ, giá, toạ độ trước khi công bố)
    const restaurants = [
        { name: 'Phở Thìn Lò Đúc', slug: 'pho-thin-lo-duc', address: '13 Lò Đúc', district: 'hai-ba-trung', lat: 21.0187, lng: 105.8566, priceMin: 50000, priceMax: 80000, openHours: '06:00 - 21:00', dish: 'pho-bo' },
        { name: 'Bún chả Hương Liên', slug: 'bun-cha-huong-lien', address: '24 Lê Văn Hưu', district: 'hai-ba-trung', lat: 21.0173, lng: 105.8517, priceMin: 50000, priceMax: 90000, openHours: '08:00 - 20:00', dish: 'bun-cha' },
        { name: 'Chả cá Thăng Long', slug: 'cha-ca-thang-long', address: '21 Đường Thành', district: 'hoan-kiem', lat: 21.0335, lng: 105.8456, priceMin: 120000, priceMax: 200000, openHours: '10:00 - 21:30', dish: 'cha-ca' },
        { name: 'Bánh cuốn Bà Hoành', slug: 'banh-cuon-ba-hoanh', address: '66 Tô Hiến Thành', district: 'hai-ba-trung', lat: 21.0163, lng: 105.8493, priceMin: 30000, priceMax: 60000, openHours: '06:30 - 21:00', dish: 'banh-cuon' },
        { name: 'Cà phê Giảng', slug: 'ca-phe-giang', address: '39 Nguyễn Hữu Huân', district: 'hoan-kiem', lat: 21.0331, lng: 105.8523, priceMin: 30000, priceMax: 50000, openHours: '07:00 - 22:00', dish: 'ca-phe-trung' },
    ];
    for (const r of restaurants) {
        const district = await prisma.district.findUniqueOrThrow({ where: { slug: r.district } });
        const dish = await prisma.dish.findUniqueOrThrow({ where: { slug: r.dish } });
        const restaurant = await prisma.restaurant.upsert({
            where: { slug: r.slug },
            update: {},
            create: {
                name: r.name, slug: r.slug, address: r.address, districtId: district.id,
                lat: r.lat, lng: r.lng, priceMin: r.priceMin, priceMax: r.priceMax, openHours: r.openHours,
                description: `Quán nổi tiếng với món ${dish.name}.`,
            },
        });
        await prisma.restaurantDish.upsert({
            where: { restaurantId_dishId: { restaurantId: restaurant.id, dishId: dish.id } },
            update: {},
            create: { restaurantId: restaurant.id, dishId: dish.id, signature: true },
        });
    }

    // 5. Công thức: phở bò
    const pho = await prisma.dish.findUniqueOrThrow({ where: { slug: 'pho-bo' } });
    const existing = await prisma.recipe.findUnique({ where: { slug: 'cach-nau-pho-bo' } });
    if (!existing) {
        await prisma.recipe.create({
            data: {
                dishId: pho.id,
                title: 'Cách nấu phở bò Hà Nội',
                slug: 'cach-nau-pho-bo',
                servings: 4,
                cookMinutes: 240,
                difficulty: Difficulty.HARD,
                stepsJson: [
                    'Chần xương bò, rửa sạch.',
                    'Nướng hành, gừng cho thơm.',
                    'Ninh xương cùng hành, gừng, quế, hồi, thảo quả khoảng 3 giờ.',
                    'Nêm muối, nước mắm cho vừa ăn.',
                    'Chần bánh phở, xếp thịt bò thái mỏng, chan nước dùng nóng.',
                ],
                ingredients: {
                    create: [
                        { name: 'Xương bò', quantity: '1', unit: 'kg' },
                        { name: 'Thịt bò', quantity: '300', unit: 'g' },
                        { name: 'Bánh phở', quantity: '500', unit: 'g' },
                        { name: 'Gừng', quantity: '1', unit: 'củ' },
                        { name: 'Hành tây', quantity: '2', unit: 'củ' },
                    ],
                },
            },
        });
    }

    // 6. Lộ trình 1 ngày
    const itinerary = await prisma.itinerary.upsert({
        where: { slug: '1-ngay-an-gi-o-ha-noi' },
        update: {},
        create: { title: '1 ngày ăn gì ở Hà Nội', slug: '1-ngay-an-gi-o-ha-noi', description: 'Lộ trình ăn uống từ sáng đến tối.' },
    });
    const stopsCount = await prisma.itineraryStop.count({ where: { itineraryId: itinerary.id } });
    if (stopsCount === 0) {
        const plan: [number, TimeSlot, string, string][] = [
            [1, TimeSlot.MORNING, 'pho-thin-lo-duc', 'Bắt đầu ngày mới bằng tô phở nóng.'],
            [2, TimeSlot.NOON, 'bun-cha-huong-lien', 'Bún chả cho bữa trưa.'],
            [3, TimeSlot.AFTERNOON, 'ca-phe-giang', 'Nghỉ chân với cà phê trứng.'],
            [4, TimeSlot.EVENING, 'cha-ca-thang-long', 'Chả cá cho bữa tối.'],
        ];
        for (const [orderNo, timeSlot, slug, note] of plan) {
            const r = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
            await prisma.itineraryStop.create({
                data: { itineraryId: itinerary.id, orderNo, timeSlot, restaurantId: r.id, note },
            });
        }
    }

    // 7. Tài khoản admin
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            name: 'Admin',
            role: 'ADMIN',
            passwordHash: await bcrypt.hash(adminPassword, 10),
        },
    });

    console.log('Seed xong.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());