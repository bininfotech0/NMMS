import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "seed-org" },
    update: {},
    create: {
      id: "seed-org",
      name: "Vedvriksha",
    },
  });

  console.log(`Seeded organization: ${org.name} (${org.id})`);

  const adminEmail = "admin@example.com";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await argon2.hash("ChangeMe123!"),
      role: "SUPER_ADMIN",
      organizationId: org.id,
    },
  });

  console.log(`Seeded user: ${admin.email} (${admin.role}) — password: ChangeMe123!`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
