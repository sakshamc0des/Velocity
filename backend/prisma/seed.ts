import { PrismaClient, TaskStatus, Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.create({
    data: { name: "Asha Verma", email: "admin@velozity.dev", passwordHash, role: "ADMIN" },
  });
  const pm1 = await prisma.user.create({
    data: { name: "Karan Mehta", email: "pm1@velozity.dev", passwordHash, role: "PM" },
  });
  const pm2 = await prisma.user.create({
    data: { name: "Neha Kapoor", email: "pm2@velozity.dev", passwordHash, role: "PM" },
  });
  const devs = await Promise.all(
    ["Ravi Kumar", "Sana Iqbal", "Arjun Rao", "Priya Nair"].map((name, i) =>
      prisma.user.create({
        data: { name, email: `dev${i + 1}@velozity.dev`, passwordHash, role: "DEVELOPER" },
      })
    )
  );

  const client1 = await prisma.client.create({ data: { name: "Nimbus Retail" } });
  const client2 = await prisma.client.create({ data: { name: "Orbit Health" } });
  const client3 = await prisma.client.create({ data: { name: "Fernweh Travel" } });

  const project1 = await prisma.project.create({
    data: { name: "Storefront Revamp", clientId: client1.id, createdById: pm1.id, description: "Rebuild the online storefront" },
  });
  const project2 = await prisma.project.create({
    data: { name: "Patient Portal", clientId: client2.id, createdById: pm2.id, description: "Patient-facing booking portal" },
  });
  const project3 = await prisma.project.create({
    data: { name: "Booking Engine V2", clientId: client3.id, createdById: pm1.id, description: "Rewrite of the booking flow" },
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const taskDefs = [
    // project1 - pm1
    { project: project1, title: "Design product grid", assignedTo: devs[0], status: TaskStatus.DONE, priority: Priority.MEDIUM, due: now - 5 * day },
    { project: project1, title: "Implement cart drawer", assignedTo: devs[0], status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, due: now + 3 * day },
    { project: project1, title: "Checkout API integration", assignedTo: devs[1], status: TaskStatus.IN_REVIEW, priority: Priority.CRITICAL, due: now + 1 * day },
    { project: project1, title: "Fix mobile nav overflow", assignedTo: devs[1], status: TaskStatus.TODO, priority: Priority.LOW, due: now - 2 * day }, // overdue
    { project: project1, title: "Add wishlist feature", assignedTo: devs[0], status: TaskStatus.TODO, priority: Priority.MEDIUM, due: now + 10 * day },

    // project2 - pm2
    { project: project2, title: "Appointment booking form", assignedTo: devs[2], status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, due: now + 2 * day },
    { project: project2, title: "Doctor availability calendar", assignedTo: devs[2], status: TaskStatus.TODO, priority: Priority.MEDIUM, due: now - 1 * day }, // overdue
    { project: project2, title: "HIPAA audit log", assignedTo: devs[3], status: TaskStatus.IN_REVIEW, priority: Priority.CRITICAL, due: now + 5 * day },
    { project: project2, title: "Patient reminder emails", assignedTo: devs[3], status: TaskStatus.DONE, priority: Priority.LOW, due: now - 4 * day },
    { project: project2, title: "Insurance verification flow", assignedTo: devs[2], status: TaskStatus.TODO, priority: Priority.HIGH, due: now + 7 * day },

    // project3 - pm1
    { project: project3, title: "Search & filter UI", assignedTo: devs[1], status: TaskStatus.TODO, priority: Priority.MEDIUM, due: now + 6 * day },
    { project: project3, title: "Rate calculation engine", assignedTo: devs[0], status: TaskStatus.IN_PROGRESS, priority: Priority.CRITICAL, due: now + 4 * day },
    { project: project3, title: "Payment gateway retry logic", assignedTo: devs[1], status: TaskStatus.TODO, priority: Priority.HIGH, due: now + 8 * day },
    { project: project3, title: "Legacy data migration", assignedTo: devs[0], status: TaskStatus.IN_REVIEW, priority: Priority.MEDIUM, due: now + 2 * day },
    { project: project3, title: "Load testing", assignedTo: devs[1], status: TaskStatus.TODO, priority: Priority.LOW, due: now + 12 * day },
  ];

  for (const def of taskDefs) {
    const isOverdue = def.due < now && def.status !== TaskStatus.DONE;
    const task = await prisma.task.create({
      data: {
        title: def.title,
        projectId: def.project.id,
        assignedToId: def.assignedTo.id,
        status: def.status,
        priority: def.priority,
        dueDate: new Date(def.due),
        isOverdue,
      },
    });

    // Pre-existing activity log entry so the feed isn't empty on first load.
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        projectId: def.project.id,
        userId: def.assignedTo.id,
        fromStatus: null,
        toStatus: def.status,
        createdAt: new Date(def.due - 6 * day),
      },
    });

    if (def.status === TaskStatus.IN_REVIEW) {
      await prisma.notification.create({
        data: {
          userId: def.project.createdById,
          taskId: task.id,
          type: "TASK_IN_REVIEW",
          message: `"${task.title}" was moved to In Review`,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("Login with any of these (password: Password123!):");
  console.log(`  Admin: ${admin.email}`);
  console.log(`  PM:    ${pm1.email}, ${pm2.email}`);
  console.log(`  Devs:  ${devs.map((d) => d.email).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
