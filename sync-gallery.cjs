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

    // Artist Collections & Custom Album Covers
    galleryData.artistsCollections = {};
    const coversFile = path.join(outputDir, 'album-covers.json');
    let customCovers = {};
    if (fs.existsSync(coversFile)) {
        try { customCovers = JSON.parse(fs.readFileSync(coversFile, 'utf8')); } catch(e) {}
    }

    if (fs.existsSync(artistsDir)) {
        const artistFolders = fs.readdirSync(artistsDir);
        artistFolders.forEach(artist => {
            const artistPath = path.join(artistsDir, artist);
            if (fs.lstatSync(artistPath).isDirectory()) {
                const entries = fs.readdirSync(artistPath);

                // 1. Direct image files inside artist directory (for student artists)
                const directFiles = entries.filter(file => {
                    const fullPath = path.join(artistPath, file);
                    if (fs.lstatSync(fullPath).isDirectory()) return false;
                    const ext = path.extname(file).toLowerCase();
                    return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.png'].includes(ext);
                });

                if (directFiles.length > 0) {
                    const directImages = directFiles.map(file => `/ARTISTS/${artist}/${file}`);
                    const folderKey = `${artist}/Artworks`;
                    let coverPath = customCovers[folderKey] || customCovers[artist] || directImages[0];
                    galleryData.artistsCollections[folderKey] = {
                        images: directImages,
                        cover: coverPath
                    };
                    galleryData.artistsCollections[artist] = {
                        images: directImages,
                        cover: coverPath
                    };
                }

                // 2. Subcategory folders (e.g. Abstract, Portraits, etc.)
                const categories = entries.filter(category => fs.lstatSync(path.join(artistPath, category)).isDirectory());
                categories.forEach(category => {
                    const categoryPath = path.join(artistPath, category);
                    const files = fs.readdirSync(categoryPath);
                    const images = files.filter(file => {
                        const ext = path.extname(file).toLowerCase();
                        return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
                    }).map(file => `/ARTISTS/${artist}/${category}/${file}`);
                    
                    const folderKey = `${artist}/${category}`;
                    const customCover = customCovers[folderKey];
                    const customCoverIsValid = !!customCover && (
                        images.includes(customCover) || fs.existsSync(path.join(__dirname, customCover.replace(/^\//, '')))
                    );
                    let coverPath = null;

                    // 1. Check custom user-selected cover from admin (even when it is not in the folder image list)
                    if (customCoverIsValid) {
                        coverPath = customCover;
                    } else {
                        // 2. Fallback to cover file starting with "cover" or first image
                        const coverFile = files.find(file => file.toLowerCase().startsWith('cover'));
                        coverPath = coverFile ? `/ARTISTS/${artist}/${category}/${coverFile}` : (images.length > 0 ? images[0] : null);
                    }

                    // Storage Key: e.g. "FLORAH MAPHOSA/Artworks"
                    galleryData.artistsCollections[folderKey] = {
                        images: images,
                        cover: coverPath
                    };
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

