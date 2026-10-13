import prisma from "../lib/prisma.js";
export async function getAllAlumni(options) {
    const where = {};
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
    let orderBy = { createdAt: "desc" };
    if (options?.sort === "name-asc")
        orderBy = { fullName: "asc" };
    else if (options?.sort === "name-desc")
        orderBy = { fullName: "desc" };
    else if (options?.sort === "year-asc")
        orderBy = { graduationYear: "asc" };
    else if (options?.sort === "year-desc")
        orderBy = { graduationYear: "desc" };
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
export async function getAlumniById(id) {
    return await prisma.alumni.findUnique({
        where: { id },
    });
}
export async function createAlumni(data) {
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
export async function updateAlumni(id, data) {
    return await prisma.alumni.update({
        where: { id },
        data,
    });
}
export async function deleteAlumni(id) {
    return await prisma.alumni.delete({
        where: { id },
    });
}
