-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cf_handle" TEXT NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" "ContestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestProblem" (
    "id" TEXT NOT NULL,
    "contest_id" TEXT NOT NULL,
    "cf_problem_id" TEXT NOT NULL,
    "problem_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,

    CONSTRAINT "ContestProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "contest_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "cf_problem_id" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solved_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedProblem" (
    "id" TEXT NOT NULL,
    "cf_problem_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "b_rating_min" INTEGER NOT NULL DEFAULT 1200,
    "b_rating_max" INTEGER NOT NULL DEFAULT 1600,
    "c_rating_min" INTEGER NOT NULL DEFAULT 1400,
    "c_rating_max" INTEGER NOT NULL DEFAULT 1700,
    "poll_interval_s" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_cf_handle_key" ON "Student"("cf_handle");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_contest_id_student_id_cf_problem_id_key" ON "Submission"("contest_id", "student_id", "cf_problem_id");

-- CreateIndex
CREATE UNIQUE INDEX "UsedProblem_cf_problem_id_key" ON "UsedProblem"("cf_problem_id");

-- AddForeignKey
ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
