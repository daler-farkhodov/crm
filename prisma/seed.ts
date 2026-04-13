import {
  AttendanceStatus,
  InvoiceStatus,
  LedgerType,
  PrismaClient,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.ledger.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.teacherEarnings.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.schoolClosure.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.studentClass.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "admin@school.local",
      fullName: "School Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: "teacher@school.local",
      fullName: "Jamie Rivera",
      role: UserRole.TEACHER,
    },
  });

  const teacher = await prisma.teacher.create({
    data: {
      fullName: "Jamie Rivera",
      userId: teacherUser.id,
    },
  });

  const math = await prisma.class.create({
    data: {
      name: "Algebra I",
      pricePerMonth: 120,
    },
  });

  await prisma.classTeacher.create({
    data: {
      classId: math.id,
      teacherId: teacher.id,
      percentage: 45,
    },
  });

  const studentA = await prisma.student.create({
    data: {
      fullName: "Alex Kim",
      startDate: new Date("2025-09-01"),
      isActive: true,
    },
  });

  const studentB = await prisma.student.create({
    data: {
      fullName: "Sam Patel",
      startDate: new Date("2025-09-15"),
      isActive: true,
    },
  });

  await prisma.studentClass.createMany({
    data: [
      {
        studentId: studentA.id,
        classId: math.id,
        startDate: new Date("2025-09-01"),
      },
      {
        studentId: studentB.id,
        classId: math.id,
        startDate: new Date("2025-09-15"),
      },
    ],
  });

  const day = new Date("2026-04-01T10:00:00.000Z");
  await prisma.attendance.createMany({
    data: [
      {
        studentId: studentA.id,
        classId: math.id,
        teacherId: teacher.id,
        date: day,
        status: AttendanceStatus.PRESENT,
      },
      {
        studentId: studentB.id,
        classId: math.id,
        teacherId: teacher.id,
        date: day,
        status: AttendanceStatus.TRIAL,
        isTrial: true,
      },
    ],
  });

  const invoice = await prisma.invoice.create({
    data: {
      studentId: studentA.id,
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      totalAmount: 120,
      creditApplied: 10,
      finalAmount: 110,
      status: InvoiceStatus.PENDING,
    },
  });

  await prisma.ledger.createMany({
    data: [
      {
        studentId: studentA.id,
        type: LedgerType.INVOICE,
        amount: 110,
        referenceId: invoice.id,
        referenceType: "Invoice",
      },
      {
        studentId: studentA.id,
        type: LedgerType.PAYMENT,
        amount: -50,
        referenceType: "Cash",
      },
    ],
  });

  await prisma.teacherEarnings.create({
    data: {
      teacherId: teacher.id,
      month: 3,
      year: 2026,
      totalAmount: 420,
      isPaid: false,
    },
  });

  await prisma.expense.create({
    data: {
      title: "Whiteboard supplies",
      amount: 48.5,
      date: new Date("2026-03-20"),
      category: "Supplies",
    },
  });

  await prisma.schoolClosure.create({
    data: {
      date: new Date("2026-01-20"),
      classId: null,
      reason: "Winter weather",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SEED",
      entity: "System",
      entityId: "seed",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
