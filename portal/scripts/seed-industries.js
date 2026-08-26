#!/usr/bin/env node
/**
 * Seed EMS + SaaS industries, default templates, backfill Contact/EmailLog industryId.
 * Usage: node scripts/seed-industries.js
 */
require('dotenv').config();
const { createId } = require('@paralleldrive/cuid2');
const { prisma } = require('../src/db');
const {
  DEFAULT_TEMPLATES,
  slugify,
} = require('../src/lib/outreach');

async function upsertIndustry({ name, slug, description, color }) {
  return prisma.industry.upsert({
    where: { slug },
    create: {
      id: createId(),
      name,
      slug: slug || slugify(name),
      description,
      color,
    },
    update: { name, description, color, isArchived: false },
  });
}

async function seedTemplates(industry, templates) {
  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: {
        industryId_followUpNum: {
          industryId: industry.id,
          followUpNum: t.followUpNum,
        },
      },
      create: {
        id: createId(),
        industryId: industry.id,
        followUpNum: t.followUpNum,
        name: t.name,
        subject: t.subject,
        body: t.body,
        templateType: t.templateType || 'ai',
      },
      update: {
        name: t.name,
        subject: t.subject,
        body: t.body,
        templateType: t.templateType || 'ai',
        isActive: true,
      },
    });
  }
}

async function main() {
  const ems = await upsertIndustry({
    name: 'EMS Companies',
    slug: 'ems',
    description: 'Electronics Manufacturing Service companies',
    color: '#f59e0b',
  });
  const saas = await upsertIndustry({
    name: 'SaaS Startups',
    slug: 'saas-startups',
    description: 'Software / AI startups (Track A)',
    color: '#6366f1',
  });

  await seedTemplates(ems, DEFAULT_TEMPLATES.ems);
  await seedTemplates(saas, DEFAULT_TEMPLATES['saas-startups']);

  const emsUpdated = await prisma.contact.updateMany({
    where: {
      OR: [{ track: { contains: 'EMS' } }, { track: { contains: 'Track B' } }],
      industryId: null,
    },
    data: { industryId: ems.id },
  });
  const saasUpdated = await prisma.contact.updateMany({
    where: {
      OR: [
        { track: { contains: 'Startup' } },
        { track: { contains: 'Track A' } },
      ],
      industryId: null,
    },
    data: { industryId: saas.id },
  });

  // Backfill EmailLog industryId from contact
  const logs = await prisma.emailLog.findMany({
    where: { industryId: null },
    include: { contact: { select: { industryId: true } } },
  });
  let logUpdated = 0;
  for (const log of logs) {
    if (log.contact?.industryId) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { industryId: log.contact.industryId },
      });
      logUpdated++;
    }
  }

  console.log(
    JSON.stringify(
      {
        ems: ems.id,
        saas: saas.id,
        contactsBackfilled: { ems: emsUpdated.count, saas: saasUpdated.count },
        emailLogsBackfilled: logUpdated,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
