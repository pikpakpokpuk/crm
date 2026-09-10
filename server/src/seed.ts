import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding...');

  // Admin user
  let admin = await prisma.user.findUnique({ where: { email: 'admin@crm.local' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { email: 'admin@crm.local', passwordHash: await bcrypt.hash('admin123', 12), name: 'Admin', role: 'ADMIN' },
    });
    console.log('Created admin:', admin.email);
  }

  // Employees
  const emp1 = await prisma.user.upsert({
    where: { email: 'varga.tibor@crm.local' },
    update: {},
    create: { email: 'varga.tibor@crm.local', passwordHash: await bcrypt.hash('employee123', 12), name: 'Varga Tibor', role: 'EMPLOYEE' },
  });
  const emp2 = await prisma.user.upsert({
    where: { email: 'kiss.zoltan@crm.local' },
    update: {},
    create: { email: 'kiss.zoltan@crm.local', passwordHash: await bcrypt.hash('employee123', 12), name: 'Kiss Zoltán', role: 'EMPLOYEE' },
  });
  console.log('Employees ready');

  // Customers + vehicles
  const cust1 = await prisma.customer.upsert({
    where: { email: 'kovacs.istvan@gmail.com' },
    update: {},
    create: {
      name: 'Kovács István', email: 'kovacs.istvan@gmail.com', phone: '+36 30 123 4567',
      address: 'Budapest, Fő utca 12', taxNumber: '12345678-1-42',
      vehicles: {
        create: [{ make: 'BMW', model: '320d', year: 2019, plate: 'ABC-123', vin: 'WBA3A5C5XDF123456', color: 'Alpine White', mileage: 87400 }],
      },
    },
    include: { vehicles: true },
  });

  const cust2 = await prisma.customer.upsert({
    where: { email: 'nagy.maria@outlook.com' },
    update: {},
    create: {
      name: 'Nagy Mária', email: 'nagy.maria@outlook.com', phone: '+36 70 987 6543',
      address: 'Győr, Kossuth utca 5',
      vehicles: {
        create: [{ make: 'Toyota', model: 'Corolla', year: 2021, plate: 'DEF-456', color: 'Silver', mileage: 34200 }],
      },
    },
    include: { vehicles: true },
  });

  const cust3 = await prisma.customer.upsert({
    where: { email: 'szabo.peter@company.hu' },
    update: {},
    create: {
      name: 'Szabó Péter Kft.', email: 'szabo.peter@company.hu', phone: '+36 1 234 5678',
      address: 'Pécs, Ipar utca 88', taxNumber: '98765432-2-02',
      vehicles: {
        create: [
          { make: 'Mercedes', model: 'Sprinter', year: 2018, plate: 'GHI-789', mileage: 142000 },
          { make: 'Ford', model: 'Transit', year: 2020, plate: 'JKL-012', mileage: 89000 },
        ],
      },
    },
    include: { vehicles: true },
  });

  console.log('Customers + vehicles ready');

  // Jobs
  const existingJobs = await prisma.job.count();
  if (existingJobs === 0) {
    await prisma.job.create({
      data: {
        createdById: admin.id,
        customerId: cust1.id,
        vehicleId: cust1.vehicles[0]?.id,
        assignedToId: emp1.id,
        description: 'Front bumper replacement and paint correction',
        damageType: 'Collision',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        estimatedPrice: 450,
        scheduledAt: new Date('2026-09-15'),
        notes: 'Customer requests OEM parts only.',
        lineItems: {
          create: [
            { sortOrder: 0, name: 'Front Bumper (OEM)', type: 'product', qty: 1, unit: 'pc', unitPrice: 280, vatPct: 27 },
            { sortOrder: 1, name: 'Paint Correction', type: 'service', qty: 4, unit: 'hr', unitPrice: 35, vatPct: 27 },
            { sortOrder: 2, name: 'Primer & Paint', type: 'product', qty: 1, unit: 'set', unitPrice: 55, vatPct: 27 },
          ],
        },
      },
    });

    await prisma.job.create({
      data: {
        createdById: admin.id,
        customerId: cust2.id,
        vehicleId: cust2.vehicles[0]?.id,
        assignedToId: emp2.id,
        description: 'Window film installation — full car',
        damageType: 'Windowfilm',
        priority: 'MEDIUM',
        status: 'NEW',
        estimatedPrice: 120,
        scheduledAt: new Date('2026-09-18'),
        lineItems: {
          create: [
            { sortOrder: 0, name: 'Window Film (35% VLT)', type: 'product', qty: 2200, unit: 'cm²', unitPrice: 0.04, vatPct: 27 },
            { sortOrder: 1, name: 'Installation', type: 'service', qty: 3, unit: 'hr', unitPrice: 12, vatPct: 27 },
          ],
        },
      },
    });

    await prisma.job.create({
      data: {
        createdById: admin.id,
        customerId: cust3.id,
        vehicleId: cust3.vehicles[0]?.id,
        assignedToId: emp1.id,
        description: 'Windshield replacement — Sprinter',
        damageType: 'Glass',
        priority: 'URGENT',
        status: 'WAITING_PARTS',
        estimatedPrice: 680,
        lineItems: {
          create: [
            { sortOrder: 0, name: 'Windshield (OEM)', type: 'product', qty: 1, unit: 'pc', unitPrice: 540, vatPct: 27 },
            { sortOrder: 1, name: 'Installation', type: 'service', qty: 2, unit: 'hr', unitPrice: 40, vatPct: 27 },
            { sortOrder: 2, name: 'Adhesive Kit', type: 'product', qty: 1, unit: 'pc', unitPrice: 35, vatPct: 27 },
          ],
        },
      },
    });

    await prisma.job.create({
      data: {
        createdById: admin.id,
        customerId: cust3.id,
        vehicleId: cust3.vehicles[1]?.id,
        description: 'Annual maintenance + window film rear',
        priority: 'LOW',
        status: 'READY',
        estimatedPrice: 200,
        finalPrice: 195,
        lineItems: {
          create: [
            { sortOrder: 0, name: 'Rear Window Film', type: 'product', qty: 800, unit: 'cm²', unitPrice: 0.04, vatPct: 27 },
            { sortOrder: 1, name: 'Maintenance Check', type: 'service', qty: 1.5, unit: 'hr', unitPrice: 45, vatPct: 27 },
          ],
        },
      },
    });

    console.log('Jobs ready');
  } else {
    console.log(`Skipped jobs (${existingJobs} already exist)`);
  }

  // Inventory
  const existingInventory = await prisma.inventoryItem.count();
  if (existingInventory === 0) {
    await prisma.inventoryItem.createMany({
      data: [
        { name: 'Window Film 35% VLT', category: 'Windowfilm', quantity: 5000, unit: 'cm²', unitPrice: 0.04 },
        { name: 'Window Film 20% VLT', category: 'Windowfilm', quantity: 3000, unit: 'cm²', unitPrice: 0.05 },
        { name: 'Window Film 50% VLT', category: 'Windowfilm', quantity: 2000, unit: 'cm²', unitPrice: 0.03 },
        { name: 'Adhesive Kit', category: 'Window', quantity: 12, unit: 'piece', unitPrice: 35 },
        { name: 'Rubber Seal Strip', category: 'Window', quantity: 8, unit: 'piece', unitPrice: 22 },
        { name: 'Cleaning Solution', category: 'Other', quantity: 15, unit: 'ml', unitPrice: 0.05 },
        { name: 'Squeegee Set', category: 'Other', quantity: 6, unit: 'piece', unitPrice: 8.5 },
      ],
    });
    console.log('Inventory ready');
  } else {
    console.log(`Skipped inventory (${existingInventory} already exist)`);
  }

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
