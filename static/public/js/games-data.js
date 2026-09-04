// Keep the featured set visible before the full catalog request completes.
// The API returns the same entries first and loadMoreGames deduplicates by embed URL.
window.VOID_GAMES = [
  { name: 'Minecraft', slug: 'featured-minecraft', embed: 'https://d1tm91r4ytbt54.cloudfront.net/2779cbcb-a02f-48a3-9e2e-95a8d123d165/1685483461665/web/index.html', cat: 'adventure', image: '/assets/featured-images/minecraft.webp', source: 'featured', new: true },
  { name: 'FNAF 1', slug: 'featured-fnaf-1', embed: 'https://irv77.github.io/hd_fnaf/1/', cat: 'horror', image: '/assets/semag-images/fnaf1.jpg', source: 'featured', new: true },
  { name: 'FNAF 2', slug: 'featured-fnaf-2', embed: 'https://irv77.github.io/hd_fnaf/2/', cat: 'horror', image: '/assets/semag-images/fnaf2.jpg', source: 'featured', new: true },
  { name: 'FNAF 3', slug: 'featured-fnaf-3', embed: 'https://irv77.github.io/hd_fnaf/3/', cat: 'horror', image: '/assets/semag-images/fnaf3.jpg', source: 'featured', new: true },
  { name: 'FNAF 4', slug: 'featured-fnaf-4', embed: 'https://irv77.github.io/hd_fnaf/4/', cat: 'horror', image: '/assets/semag-images/fnaf4.jpg', source: 'featured', new: true },
  { name: 'FNAF World', slug: 'featured-fnaf-world', embed: 'https://irv77.github.io/hd_fnaf/w/', cat: 'horror', image: null, source: 'featured', new: true },
  { name: 'FNAF Sister Location', slug: 'featured-fnaf-sister-location', embed: 'https://irv77.github.io/hd_fnaf/sl/', cat: 'horror', image: null, source: 'featured', new: true },
  { name: 'FNAF Pizzeria Simulator', slug: 'featured-fnaf-pizzeria-simulator', embed: 'https://irv77.github.io/hd_fnaf/ps/', cat: 'horror', image: null, source: 'featured', new: true },
  { name: 'FNAF Ultimate Custom Night', slug: 'featured-fnaf-ultimate-custom-night', embed: 'https://irv77.github.io/hd_fnaf/ucn/', cat: 'horror', image: null, source: 'featured', new: true }
];