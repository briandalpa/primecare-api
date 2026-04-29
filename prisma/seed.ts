import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = 'Password123!';
const PICKUP_DATE = new Date('2026-04-25T09:00:00.000Z');
const DONE_DATE = new Date('2026-04-26T10:00:00.000Z');
const CONFIRM_DATE = new Date('2026-04-27T14:00:00.000Z');

const LAUNDRY_ITEMS = [
  { name: 'Shirt', slug: 'shirt' },
  { name: 'T-Shirt', slug: 't-shirt' },
  { name: 'Polo Shirt', slug: 'polo-shirt' },
  { name: 'Pants', slug: 'pants' },
  { name: 'Jeans', slug: 'jeans' },
  { name: 'Shorts', slug: 'shorts' },
  { name: 'Dress', slug: 'dress' },
  { name: 'Skirt', slug: 'skirt' },
  { name: 'Jacket', slug: 'jacket' },
  { name: 'Coat', slug: 'coat' },
  { name: 'Sweater', slug: 'sweater' },
  { name: 'Hoodie', slug: 'hoodie' },
  { name: 'Underwear', slug: 'underwear' },
  { name: 'Socks', slug: 'socks' },
  { name: 'Towel', slug: 'towel' },
  { name: 'Bath Towel', slug: 'bath-towel' },
  { name: 'Hand Towel', slug: 'hand-towel' },
  { name: 'Bedsheet', slug: 'bedsheet' },
  { name: 'Pillowcase', slug: 'pillowcase' },
  { name: 'Duvet Cover', slug: 'duvet-cover' },
  { name: 'Blanket', slug: 'blanket' },
  { name: 'Curtain', slug: 'curtain' },
  { name: 'Tablecloth', slug: 'tablecloth' },
  { name: 'Uniform', slug: 'uniform' },
  { name: 'Suit', slug: 'suit' },
  { name: 'Traditional Wear', slug: 'traditional-wear' },
  { name: 'Bag', slug: 'bag' },
  { name: 'Shoes', slug: 'shoes' },
];

const seedLaundryItems = async () => {
  await Promise.all(
    LAUNDRY_ITEMS.map((item) =>
      prisma.laundryItem.upsert({
        where: { slug: item.slug },
        update: { name: item.name, isActive: true },
        create: { name: item.name, slug: item.slug, isActive: true },
      }),
    ),
  );
  console.log(`Seeded ${LAUNDRY_ITEMS.length} laundry items.`);
};

const clearDemoData = async () => {
  await prisma.$transaction(async (tx) => {
    await tx.bypassRequest.deleteMany();
    await tx.stationItem.deleteMany();
    await tx.stationRecord.deleteMany();
    await tx.complaint.deleteMany();
    await tx.delivery.deleteMany();
    await tx.payment.deleteMany();
    await tx.orderItem.deleteMany();
    await tx.order.deleteMany();
    await tx.pickupRequest.deleteMany();
    await tx.shift.deleteMany();
    await tx.address.deleteMany();
    await tx.staff.deleteMany();
    await tx.outlet.deleteMany();
    await tx.session.deleteMany();
    await tx.account.deleteMany();
    await tx.user.deleteMany();
  });
  console.log('Cleared all data.');
};

const seedSuperAdmin = async () => {
  const existing = await prisma.staff.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (existing) {
    console.log('Skipping super admin because it already exists.');
    return;
  }

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const accountId = uuidv4();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    await tx.account.create({
      data: {
        id: accountId,
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });

    await tx.staff.create({
      data: {
        userId,
        role: 'SUPER_ADMIN',
      },
    });
  });

  console.log(`Super admin created: ${email}`);
};

// --- helpers ---

const makeUser = async (name: string, email: string, pw: string): Promise<string> => {
  const userId = uuidv4();
  const now = new Date();
  await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      accounts: {
        create: {
          id: uuidv4(),
          accountId: userId,
          providerId: 'credential',
          password: pw,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  });
  return userId;
};

const makeStaff = async (
  name: string,
  email: string,
  pw: string,
  outletId: string,
  role: 'OUTLET_ADMIN' | 'WORKER' | 'DRIVER',
  workerType?: 'WASHING' | 'IRONING' | 'PACKING',
): Promise<string> => {
  const userId = await makeUser(name, email, pw);
  const staff = await prisma.staff.create({
    data: { userId, outletId, role, workerType: workerType ?? null, isActive: true },
  });
  return staff.id;
};

interface Ids {
  outletId: string;
  outletAdminId: string;
  driverId: string;
  washerId: string;
  ironerId: string;
  packerId: string;
  customerId: string;
  addressId: string;
  shirtId: string;
  jeansId: string;
}

const makePickup = async (
  ids: Ids,
  status: 'PENDING' | 'DRIVER_ASSIGNED' | 'PICKED_UP' | 'CANCELLED',
  withDriver = false,
): Promise<string> => {
  const pickup = await prisma.pickupRequest.create({
    data: {
      customerId: ids.customerId,
      addressId: ids.addressId,
      outletId: ids.outletId,
      driverId: withDriver ? ids.driverId : null,
      scheduledAt: PICKUP_DATE,
      status,
    },
  });
  return pickup.id;
};

const makeOrder = async (
  pickupId: string,
  ids: Ids,
  status: string,
  paymentStatus: 'UNPAID' | 'PAID',
  confirmedAt?: Date,
): Promise<{ id: string; totalPrice: number }> => {
  const totalWeightKg = 2.5;
  const pricePerKg = 15000;
  const deliveryFee = 12000;
  const totalPrice = totalWeightKg * pricePerKg + deliveryFee;

  const order = await prisma.order.create({
    data: {
      pickupRequestId: pickupId,
      outletId: ids.outletId,
      staffId: ids.outletAdminId,
      totalWeightKg,
      pricePerKg,
      totalPrice,
      deliveryDistanceKm: 6,
      deliveryFee,
      paymentStatus,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: status as any,
      confirmedAt: confirmedAt ?? null,
      items: {
        create: [
          { laundryItemId: ids.shirtId, quantity: 3, isManualPriced: false },
          { laundryItemId: ids.jeansId, quantity: 2, isManualPriced: false },
        ],
      },
    },
  });

  return { id: order.id, totalPrice: order.totalPrice };
};

const makeStation = async (
  orderId: string,
  station: 'WASHING' | 'IRONING' | 'PACKING',
  staffId: string,
  status: 'IN_PROGRESS' | 'BYPASS_REQUESTED' | 'COMPLETED',
  ids: Ids,
  shirtQty: number,
): Promise<string> => {
  const record = await prisma.stationRecord.create({
    data: {
      orderId,
      station,
      staffId,
      status,
      completedAt: status === 'COMPLETED' ? DONE_DATE : null,
      stationItems: {
        create: [
          { laundryItemId: ids.shirtId, quantity: shirtQty },
          { laundryItemId: ids.jeansId, quantity: 2 },
        ],
      },
    },
  });
  return record.id;
};

const makeAllStationsCompleted = async (orderId: string, ids: Ids) => {
  for (const [station, staffId] of [
    ['WASHING', ids.washerId],
    ['IRONING', ids.ironerId],
    ['PACKING', ids.packerId],
  ] as const) {
    await makeStation(orderId, station, staffId, 'COMPLETED', ids, 3);
  }
};

const makePaidPayment = async (orderId: string, amount: number) => {
  await prisma.payment.create({
    data: {
      orderId,
      amount,
      gateway: 'midtrans',
      gatewayTxId: `DEMO-${uuidv4().slice(0, 8).toUpperCase()}`,
      status: 'PAID',
      paidAt: DONE_DATE,
    },
  });
};

// --- scenario builder ---

const seedDemoData = async (pw: string) => {
  // Outlet
  const outlet = await prisma.outlet.create({
    data: {
      name: 'PrimeCare Jakarta Selatan',
      address: 'Jl. Kemang Raya No. 1',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      latitude: -6.2615,
      longitude: 106.8106,
      maxServiceRadiusKm: 15,
      isActive: true,
    },
  });

  const outletAdminId = await makeStaff('Alice Manager', 'outletadmin@primecare.com', pw, outlet.id, 'OUTLET_ADMIN');
  const driverId = await makeStaff('Bob Driver', 'driver@primecare.com', pw, outlet.id, 'DRIVER');
  const washerId = await makeStaff('Charlie Wash', 'washing@primecare.com', pw, outlet.id, 'WORKER', 'WASHING');
  const ironerId = await makeStaff('Diana Iron', 'ironing@primecare.com', pw, outlet.id, 'WORKER', 'IRONING');
  const packerId = await makeStaff('Eve Pack', 'packing@primecare.com', pw, outlet.id, 'WORKER', 'PACKING');

  const customerId = await makeUser('John Customer', 'customer@primecare.com', pw);

  const address = await prisma.address.create({
    data: {
      userId: customerId,
      label: 'Home',
      street: 'Jl. Sudirman No. 123',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      latitude: -6.2088,
      longitude: 106.8456,
      phone: '+6281234567890',
      isPrimary: true,
    },
  });

  await prisma.shift.createMany({
    data: [
      { outletId: outlet.id, staffId: washerId, startTime: DONE_DATE },
      { outletId: outlet.id, staffId: ironerId, startTime: DONE_DATE },
      { outletId: outlet.id, staffId: packerId, startTime: DONE_DATE },
    ],
  });

  const shirtItem = await prisma.laundryItem.findUnique({ where: { slug: 'shirt' } });
  const jeansItem = await prisma.laundryItem.findUnique({ where: { slug: 'jeans' } });
  if (!shirtItem || !jeansItem) throw new Error('LaundryItems missing. Run seedLaundryItems first.');

  const ids: Ids = {
    outletId: outlet.id,
    outletAdminId,
    driverId,
    washerId,
    ironerId,
    packerId,
    customerId,
    addressId: address.id,
    shirtId: shirtItem.id,
    jeansId: jeansItem.id,
  };

  // 1 — WAITING_FOR_PICKUP_DRIVER
  await makeOrder(await makePickup(ids, 'PENDING'), ids, 'WAITING_FOR_PICKUP_DRIVER', 'UNPAID');

  // 2 — LAUNDRY_EN_ROUTE_TO_OUTLET
  await makeOrder(await makePickup(ids, 'DRIVER_ASSIGNED', true), ids, 'LAUNDRY_EN_ROUTE_TO_OUTLET', 'UNPAID');

  // 3 — LAUNDRY_ARRIVED_AT_OUTLET
  await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_ARRIVED_AT_OUTLET', 'UNPAID');

  // 4 — LAUNDRY_BEING_WASHED (normal)
  {
    const { id: orderId } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_BEING_WASHED', 'UNPAID');
    await makeStation(orderId, 'WASHING', washerId, 'IN_PROGRESS', ids, 3);
  }

  // 5 — LAUNDRY_BEING_WASHED (bypass pending)
  {
    const { id: orderId } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_BEING_WASHED', 'UNPAID');
    const stationRecordId = await makeStation(orderId, 'WASHING', washerId, 'BYPASS_REQUESTED', ids, 2);
    await prisma.bypassRequest.create({
      data: { stationRecordId, workerId: washerId, status: 'PENDING' },
    });
  }

  // 6 — LAUNDRY_BEING_IRONED
  {
    const { id: orderId } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_BEING_IRONED', 'UNPAID');
    await makeStation(orderId, 'WASHING', washerId, 'COMPLETED', ids, 3);
    await makeStation(orderId, 'IRONING', ironerId, 'IN_PROGRESS', ids, 3);
  }

  // 7 — LAUNDRY_BEING_PACKED
  {
    const { id: orderId } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_BEING_PACKED', 'UNPAID');
    await makeStation(orderId, 'WASHING', washerId, 'COMPLETED', ids, 3);
    await makeStation(orderId, 'IRONING', ironerId, 'COMPLETED', ids, 3);
    await makeStation(orderId, 'PACKING', packerId, 'IN_PROGRESS', ids, 3);
  }

  // 8 — WAITING_FOR_PAYMENT
  {
    const { id: orderId, totalPrice } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'WAITING_FOR_PAYMENT', 'UNPAID');
    await makeAllStationsCompleted(orderId, ids);
    await prisma.payment.create({
      data: { orderId, amount: totalPrice, gateway: 'midtrans', status: 'PENDING' },
    });
  }

  // 9 — LAUNDRY_READY_FOR_DELIVERY (delivery pending)
  {
    const { id: orderId, totalPrice } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_READY_FOR_DELIVERY', 'PAID');
    await makeAllStationsCompleted(orderId, ids);
    await makePaidPayment(orderId, totalPrice);
    await prisma.delivery.create({ data: { orderId, status: 'PENDING' } });
  }

  // 10 — LAUNDRY_OUT_FOR_DELIVERY (driver assigned)
  {
    const { id: orderId, totalPrice } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_OUT_FOR_DELIVERY', 'PAID');
    await makeAllStationsCompleted(orderId, ids);
    await makePaidPayment(orderId, totalPrice);
    await prisma.delivery.create({ data: { orderId, driverId, status: 'DRIVER_ASSIGNED' } });
  }

  // 11 — LAUNDRY_OUT_FOR_DELIVERY (en route)
  {
    const { id: orderId, totalPrice } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_OUT_FOR_DELIVERY', 'PAID');
    await makeAllStationsCompleted(orderId, ids);
    await makePaidPayment(orderId, totalPrice);
    await prisma.delivery.create({ data: { orderId, driverId, status: 'OUT_FOR_DELIVERY' } });
  }

  // 12 — LAUNDRY_DELIVERED_TO_CUSTOMER + complaint OPEN
  {
    const { id: orderId, totalPrice } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'LAUNDRY_DELIVERED_TO_CUSTOMER', 'PAID');
    await makeAllStationsCompleted(orderId, ids);
    await makePaidPayment(orderId, totalPrice);
    await prisma.delivery.create({ data: { orderId, driverId, status: 'DELIVERED', deliveredAt: DONE_DATE } });
    await prisma.complaint.create({
      data: {
        orderId,
        customerId,
        description: 'My shirt still has stains after washing. Please review.',
        status: 'OPEN',
      },
    });
  }

  // 13 — COMPLETED + complaint IN_REVIEW
  {
    const { id: orderId, totalPrice } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'COMPLETED', 'PAID', CONFIRM_DATE);
    await makeAllStationsCompleted(orderId, ids);
    await makePaidPayment(orderId, totalPrice);
    await prisma.delivery.create({ data: { orderId, driverId, status: 'DELIVERED', deliveredAt: DONE_DATE } });
    await prisma.complaint.create({
      data: {
        orderId,
        customerId,
        description: 'Clothes were returned in a wrinkled condition. Currently under review.',
        status: 'IN_REVIEW',
      },
    });
  }

  // 14 — COMPLETED + complaint RESOLVED
  {
    const { id: orderId, totalPrice } = await makeOrder(await makePickup(ids, 'PICKED_UP', true), ids, 'COMPLETED', 'PAID', CONFIRM_DATE);
    await makeAllStationsCompleted(orderId, ids);
    await makePaidPayment(orderId, totalPrice);
    await prisma.delivery.create({ data: { orderId, driverId, status: 'DELIVERED', deliveredAt: DONE_DATE } });
    await prisma.complaint.create({
      data: {
        orderId,
        customerId,
        description: 'Shoes were returned as mismatched pairs after laundry. Issue has been resolved.',
        status: 'RESOLVED',
      },
    });
  }

  // Cancelled pickup (no order)
  await makePickup(ids, 'CANCELLED');

  console.log('Created outlet, 6 staff accounts, 1 customer, 14 orders, 1 cancelled pickup.');
  console.log('\nDemo accounts (password: Password123!):');
  console.log('  customer@primecare.com     — Customer');
  console.log('  outletadmin@primecare.com  — Outlet Admin');
  console.log('  driver@primecare.com       — Driver');
  console.log('  washing@primecare.com      — Washing Worker');
  console.log('  ironing@primecare.com      — Ironing Worker');
  console.log('  packing@primecare.com      — Packing Worker');
};

const main = async () => {
  await seedLaundryItems();
  await clearDemoData();
  await seedSuperAdmin();
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  await seedDemoData(hashedPassword);
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
