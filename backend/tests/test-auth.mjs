import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log('Testing authentication...');

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: 'admin@softaware.local' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.id);
    console.log('   Email:', user.email);
    console.log('   Has passwordHash:', !!user.passwordHash);

    // Test password comparison
    const testPassword = 'Password123!';
    const isValid = await bcrypt.compare(testPassword, user.passwordHash);
    console.log('   Password valid:', isValid);

    // Check JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    console.log('   JWT_SECRET exists:', !!jwtSecret);
    console.log('   JWT_SECRET length:', jwtSecret?.length || 0);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();
