import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    // Calentar el pool de conexiones para que la primera petición real no sufra el cold-start
    await this.$queryRaw`SELECT 1`.catch(() => {/* ignorar si falla */});
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
