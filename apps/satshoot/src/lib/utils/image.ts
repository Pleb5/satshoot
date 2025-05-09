/**
 * Calculates the greatest common divisor of two numbers
 * @param a First number
 * @param b Second number
 * @returns Greatest common divisor
 */
function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
}

/**
 * Gets the aspect ratio of an image file in "width:height" format
 * @param file The image file
 * @returns Promise resolving to aspect ratio string (e.g., "16:9")
 */
export async function getAspectRatio(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new Error('File is not an image');
    }

    // Create image element to get dimensions
    const img = new Image();
    const url = URL.createObjectURL(file);

    // Wait for image to load
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
    });

    // Clean up object URL
    URL.revokeObjectURL(url);

    // Calculate greatest common divisor to simplify ratio
    const divisor = gcd(img.width, img.height);
    const widthRatio = img.width / divisor;
    const heightRatio = img.height / divisor;

    // Return simplified ratio
    return `${widthRatio}:${heightRatio}`;
}

interface StandardRatio {
    name: string;
    value: number;
}

const STANDARD_RATIOS: StandardRatio[] = [
    { name: '1:1', value: 1 },
    { name: '4:3', value: 4 / 3 },
    { name: '3:2', value: 3 / 2 },
    { name: '16:9', value: 16 / 9 },
    { name: '9:16', value: 9 / 16 },
    { name: '21:9', value: 21 / 9 },
];

/**
 * Gets the aspect ratio, matching to standard ratios when close
 * @param file The image file
 * @param tolerance Allowed deviation from standard ratios (default 0.05 = 5%)
 * @returns Promise resolving to aspect ratio string
 */
export async function getStandardAspectRatio(
    file: File,
    tolerance: number = 0.05
): Promise<string> {
    const rawRatio = await getAspectRatio(file);
    const [width, height] = rawRatio.split(':').map(Number);
    const actualRatio = width / height;

    // Find closest standard ratio
    let closestRatio = STANDARD_RATIOS[0];
    let smallestDiff = Infinity;

    for (const ratio of STANDARD_RATIOS) {
        const diff = Math.abs(actualRatio - ratio.value);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closestRatio = ratio;
        }
    }

    // Return standard ratio if within tolerance, otherwise exact ratio
    return smallestDiff <= tolerance ? closestRatio.name : rawRatio;
}
