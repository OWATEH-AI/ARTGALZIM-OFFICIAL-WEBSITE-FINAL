const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'images', 'MAIN IMAGES');
const artistsDir = path.join(__dirname, 'ARTISTS');
const outputDir = path.join(__dirname, 'js');
const outputFile = path.join(outputDir, 'page-galleries.js');

const folders = ['home', 'exhibitions', 'artists', 'artworks', 'about', 'visit', 'blog'];

function getImages() {
    const galleryData = {};

    // Standard folders
    folders.forEach(folder => {
        const folderPath = path.join(baseDir, folder);
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            const images = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
            }).map(file => `/images/MAIN IMAGES/${folder}/${file}`);
            
            galleryData[folder] = images;
        } else {
            galleryData[folder] = [];
        }
    });

    // Hero Animation Folder
    const heroPath = path.join(__dirname, 'HERO ANIMATION');
    if (fs.existsSync(heroPath)) {
        const files = fs.readdirSync(heroPath);
        let heroFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.JPG'].includes(ext);
        }).map(file => `/HERO ANIMATION/${file}`);
        
        // Ensure "Art Gallery Frontview" is always the first item
        heroFiles.sort((a, b) => {
            const aIsFrontview = a.toLowerCase().includes("art gallery frontview");
            const bIsFrontview = b.toLowerCase().includes("art gallery frontview");
            if (aIsFrontview && !bIsFrontview) return -1;
            if (!aIsFrontview && bIsFrontview) return 1;
            return 0;
        });
        
        galleryData.hero = heroFiles;
    } else {
        galleryData.hero = [];
    }

    // Artist Collections
    galleryData.artistsCollections = {};
    if (fs.existsSync(artistsDir)) {
        const artistFolders = fs.readdirSync(artistsDir);
        artistFolders.forEach(artist => {
            const artistPath = path.join(artistsDir, artist);
            if (fs.lstatSync(artistPath).isDirectory()) {
                const categories = fs.readdirSync(artistPath);
                categories.forEach(category => {
                    const categoryPath = path.join(artistPath, category);
                    if (fs.lstatSync(categoryPath).isDirectory()) {
                        const files = fs.readdirSync(categoryPath);
                        const images = files.filter(file => {
                            const ext = path.extname(file).toLowerCase();
                            return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
                        }).map(file => `/ARTISTS/${artist}/${category}/${file}`);
                        
                        // Find a cover image (e.g. cover.png, cover.jpg, or anything starting with "cover")
                        const coverFile = files.find(file => file.toLowerCase().startsWith('cover'));
                        const coverPath = coverFile ? `/ARTISTS/${artist}/${category}/${coverFile}` : (images.length > 0 ? images[0] : null);

                        // Storage Key: e.g. "WILLARD MAGIGA/Abstracts"
                        galleryData.artistsCollections[`${artist}/${category}`] = {
                            images: images,
                            cover: coverPath
                        };
                    }
                });
            }
        });
    }

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
    console.log('Folders scanned in MAIN IMAGES:', folders.length);
    console.log('Artist categories found:', Object.keys(data.artistsCollections).length);
}

generateConfig();

