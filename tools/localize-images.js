// Replaces broken/external Unsplash photo URLs with locally generated images
// and points the contact-page map at a generic Haiti location instead of the
// placeholder Eiffel Tower embed.
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public");

// Map each distinct unsplash photo id (regardless of query params) to a local asset.
const photoMap = [
  [/https:\/\/images\.unsplash\.com\/photo-1509391366360-fe5bb58583bb[^"]*/g, "images/hero-solar.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1497435334941-8c899ee9e8e9[^"]*/g, "images/commercial-solar.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1508514177221-188b1cf16e9d[^"]*/g, "images/residential-solar.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1542013936693-884638332954[^"]*/g, "images/hotel-hybrid.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1621905235277-33829979ee0b[^"]*/g, "images/auto-workshop.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1466611653911-95081537e5b7[^"]*/g, "images/services-header.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1542332213-31f87348057f[^"]*/g, "images/team-photo.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1544724569-5f546fd6f2b5[^"]*/g, "images/product-solar-panel-2.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1558494949-ef010cbdcc48[^"]*/g, "images/product-battery.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1568992688065-536aad8a12f6[^"]*/g, "images/product-inverter.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1581092160562-40aa08e78837[^"]*/g, "images/product-mppt.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1594818371393-32467d1c68e1[^"]*/g, "images/product-generator.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1620288627223-53302f4e8c74[^"]*/g, "images/product-generator-2.jpg"],
  [/https:\/\/images\.unsplash\.com\/photo-1620714223084-8fcacc6dfd8d[^"]*/g, "images/product-cables.jpg"],
];

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
  let html = fs.readFileSync(path.join(dir, file), "utf8");
  for (const [re, replacement] of photoMap) {
    html = html.replace(re, replacement);
  }
  // Point the map embed at Port-au-Prince instead of the sample Eiffel Tower location.
  html = html.replace(
    /https:\/\/www\.google\.com\/maps\/embed\?[^"]*/g,
    "https://www.google.com/maps?q=Port-au-Prince,Haiti&output=embed"
  );
  fs.writeFileSync(path.join(dir, file), html);
  console.log(`Localized images in ${file}`);
}
