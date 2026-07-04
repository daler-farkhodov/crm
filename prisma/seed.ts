import {
  AttendanceStatus,
  ClassRole,
  InvoiceStatus,
  LedgerType,
  PrismaClient,
  SalaryType,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.teacherLedger.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.ledger.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.teacherEarnings.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.assistantAttendance.deleteMany();
  await prisma.schoolClosure.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.classTeacherOverride.deleteMany();
  await prisma.studentClass.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.room.deleteMany();
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

  // Assistant for the class, and a separate substitute teacher used below.
  const assistant = await prisma.teacher.create({
    data: { fullName: "Morgan Lee" },
  });
  const substitute = await prisma.teacher.create({
    data: { fullName: "Taylor Brooks" },
  });

  const room = await prisma.room.create({
    data: { name: "Math room" },
  });

  const math = await prisma.class.create({
    data: {
      name: "Algebra I",
      roomId: room.id,
      startHour: 15,
      endHour: 16,
      pricePerMonth: 120,
      scheduleDays: ["MON", "WED", "FRI"],
    },
  });

  await prisma.classTeacher.create({
    data: {
      classId: math.id,
      teacherId: teacher.id,
      role: ClassRole.TEACHER,
      salaryType: SalaryType.PERCENTAGE,
      percentage: 45,
    },
  });

  const assistantClassTeacher = await prisma.classTeacher.create({
    data: {
      classId: math.id,
      teacherId: assistant.id,
      role: ClassRole.ASSISTANT,
      salaryType: SalaryType.FIXED,
      fixedAmount: 60,
    },
  });

  const studentA = await prisma.student.create({
    data: {
      fullName: "Alex Kim",
      startDate: new Date("2025-09-01"),
      isActive: true,
      nextPaymentDue: new Date("2026-05-01"),
    },
  });

  const studentB = await prisma.student.create({
    data: {
      fullName: "Sam Patel",
      startDate: new Date("2025-09-15"),
      isActive: true,
      nextPaymentDue: new Date("2026-04-01"),
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

  // Assistant was marked present for that session → accrues assistant pay.
  await prisma.assistantAttendance.create({
    data: {
      classTeacherId: assistantClassTeacher.id,
      date: day,
      present: true,
      recordedByTeacherId: teacher.id,
    },
  });

  // A substitute covered the class on a different date.
  await prisma.classTeacherOverride.create({
    data: {
      classId: math.id,
      date: new Date("2026-03-25T10:00:00.000Z"),
      originalTeacherId: teacher.id,
      substituteTeacherId: substitute.id,
      reason: "Teacher out sick",
    },
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

  await prisma.invoiceLine.create({
    data: {
      invoiceId: invoice.id,
      classId: math.id,
      amount: 120,
    },
  });

  await prisma.ledger.createMany({
    data: [
      {
        studentId: studentA.id,
        type: LedgerType.CREDIT,
        amount: -10,
        referenceType: "SeedAdjust",
      },
      {
        studentId: studentA.id,
        type: LedgerType.INVOICE,
        amount: 120,
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

  // Teacher pre-payment (replaces the old TeacherAdvance model — Item 2).
  await prisma.expense.create({
    data: {
      title: `Pre-payment — ${teacher.fullName}`,
      amount: 100,
      date: new Date("2026-03-10"),
      teacherId: teacher.id,
      deductMonth: 3,
      deductYear: 2026,
      isDeducted: false,
      paymentMethod: "CASH",
    },
  });

  await prisma.teacherLedger.create({
    data: {
      teacherId: teacher.id,
      classId: math.id,
      date: day,
      type: "ACCRUAL",
      amount: 4.5,
      referenceId: invoice.id,
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
