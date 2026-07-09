const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const post = await prisma.blogPost.findUnique({
    where: { slug: "understanding-postal-codes-in-sri-lanka" }
  });
  console.log("Post:", post);
}

main().finally(() => prisma.$disconnect());
