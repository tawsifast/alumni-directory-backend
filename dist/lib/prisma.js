import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
let prismaInstance = null;
export function getPrisma() {
    if (!prismaInstance) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error("DATABASE_URL is not defined in environment variables. Please check your .env file.");
        }
        const adapter = new PrismaPg({
            connectionString,
        });
        prismaInstance = new PrismaClient({ adapter });
    }
    return prismaInstance;
}
const prisma = new Proxy({}, {
    get(_target, prop, receiver) {
        const client = getPrisma();
        const value = Reflect.get(client, prop, receiver);
        if (typeof value === "function") {
            return value.bind(client);
        }
        return value;
    },
});
export default prisma;
