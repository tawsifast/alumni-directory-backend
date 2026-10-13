import prisma from "../lib/prisma.js";

export interface CreateAlumniInput {
  fullName: string;
  email: string;
  graduationYear: number;
  department: string;
  currentCompany?: string | null;
  currentPosition?: string | null;
  location?: string | null;
}

export type UpdateAlumniInput = Partial<CreateAlumniInput>;

export type AlumniSortOption = "name-asc" | "name-desc" | "year-desc" | "year-asc";

export interface AlumniFilterOptions {
  search?: string;
  graduationYear?: number;
  department?: string;
  sort?: AlumniSortOption;
  page?: number;
  limit?: number;
}

export interface AlumniListResult {
  data: Array<{
    id: string;
    fullName: string;
    email: string;
    graduationYear: number;
    department: string;
    currentCompany: string | null;
    currentPosition: string | null;
    location: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAllAlumni(options?: AlumniFilterOptions): Promise<AlumniListResult> {
  const where: Record<string, unknown> = {};

  if (options?.search) {
    where.fullName = {
      contains: options.search,
      mode: "insensitive",
    };
  }

  if (options?.graduationYear) {
    where.graduationYear = options.graduationYear;
  }

  if (options?.department) {
    where.department = {
      equals: options.department,
      mode: "insensitive",
    };
  }

  let orderBy: Record<string, "asc" | "desc"> = { createdAt: "desc" };
  if (options?.sort === "name-asc") orderBy = { fullName: "asc" };
  else if (options?.sort === "name-desc") orderBy = { fullName: "desc" };
  else if (options?.sort === "year-asc") orderBy = { graduationYear: "asc" };
  else if (options?.sort === "year-desc") orderBy = { graduationYear: "desc" };

  const page = options?.page && options.page > 0 ? options.page : 1;
  const limit = options?.limit && options.limit > 0 ? options.limit : 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.alumni.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.alumni.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getAlumniById(id: string) {
  return await prisma.alumni.findUnique({
    where: { id },
  });
}

export async function createAlumni(data: CreateAlumniInput) {
  return await prisma.alumni.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      graduationYear: data.graduationYear,
      department: data.department,
      currentCompany: data.currentCompany ?? null,
      currentPosition: data.currentPosition ?? null,
      location: data.location ?? null,
    },
  });
}

export async function updateAlumni(id: string, data: UpdateAlumniInput) {
  return await prisma.alumni.update({
    where: { id },
    data,
  });
}

export async function deleteAlumni(id: string) {
  return await prisma.alumni.delete({
    where: { id },
  });
}
