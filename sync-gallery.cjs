const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'images', 'MAIN IMAGES');
const outputDir = path.join(__dirname, 'js');
const outputFile = path.join(outputDir, 'page-galleries.js');

const folders = ['home', 'exhibitions', 'artists', 'artworks', 'about', 'visit', 'blog'];

function getImages() {
    const galleryData = {};

    folders.forEach(folder => {
        const folderPath = path.join(baseDir, folder);
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            const images = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
            }).map(file => `images/MAIN IMAGES/${folder}/${file}`);
            
            galleryData[folder] = images;
        } else {
            galleryData[folder] = [];
        }
    });

    return galleryData;
}

function generateConfig() {
    const data = getImages();
    const content = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Run 'node sync-gallery.js' to update this config after adding images to images/pages/ folders.
 */
const PageGalleries = ${JSON.stringify(data, null, 2)};

if (typeof window !== 'undefined') {
    window.PageGalleries = PageGalleries;
}
`;

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, content);
    console.log('✓ Gallery configuration updated in js/page-galleries.js');
    console.log('Folders scanned in MAIN IMAGES:', Object.keys(data).map(k => `${k} (${data[k].length})`).join(', '));
}

generateConfig();
