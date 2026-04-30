import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MUMBAI_RESTAURANTS = [
  {
    name: 'Trishna',
    address: 'Sai Baba Marg, Kala Ghoda, Fort, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Trishna/@18.9322,72.8318,17z',
    cuisine: 'Seafood',
    priceLevel: 'expensive',
  },
  {
    name: 'Wasabi by Morimoto',
    address: 'Taj Mahal Palace Hotel, Apollo Bunder, Colaba, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Wasabi+by+Morimoto/@18.9219,72.8328,17z',
    cuisine: 'Japanese',
    priceLevel: 'very_expensive',
  },
  {
    name: 'The Table',
    address: 'Kaala Ghoda, Fort, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/The+Table/@18.9285,72.8327,17z',
    cuisine: 'Modern European',
    priceLevel: 'expensive',
  },
  {
    name: 'Bastian',
    address: 'Linking Road, Bandra West, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Bastian/@19.0548,72.8301,17z',
    cuisine: 'Seafood',
    priceLevel: 'expensive',
  },
  {
    name: 'Pali Village Café',
    address: 'Pali Hill, Bandra West, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Pali+Village+Cafe/@19.0604,72.8286,17z',
    cuisine: 'All Day Dining',
    priceLevel: 'moderate',
  },
  {
    name: 'Hakkasan',
    address: 'Bandra Kurla Complex, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Hakkasan/@19.0668,72.8697,17z',
    cuisine: 'Chinese',
    priceLevel: 'very_expensive',
  },
  {
    name: 'Khyber',
    address: 'M.G. Road, Fort, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Khyber/@18.9318,72.8338,17z',
    cuisine: 'North Indian',
    priceLevel: 'expensive',
  },
  {
    name: 'Cafe Mondegar',
    address: 'Colaba Causeway, Colaba, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Cafe+Mondegar/@18.9219,72.8317,17z',
    cuisine: 'Continental',
    priceLevel: 'moderate',
  },
  {
    name: 'Britannia & Co.',
    address: 'Sprott Road, Ballard Estate, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Britannia+%26+Co./@18.9337,72.8394,17z',
    cuisine: 'Parsi',
    priceLevel: 'budget',
  },
  {
    name: 'Burma Burma',
    address: 'Horniman Circle, Fort, Mumbai',
    googleMapsUrl: 'https://www.google.com/maps/place/Burma+Burma/@18.9308,72.8341,17z',
    cuisine: 'Burmese',
    priceLevel: 'moderate',
  },
];

async function main() {
  console.log('Seeding 10 Mumbai restaurants...');

  for (const r of MUMBAI_RESTAURANTS) {
    await prisma.restaurant.upsert({
      where: { googleMapsUrl: r.googleMapsUrl },
      update: {},
      create: r,
    });
    console.log(`  ✓ ${r.name}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
