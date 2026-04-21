import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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

const main = async () => {
  await seedLaundryItems();
  await seedSuperAdmin();
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
