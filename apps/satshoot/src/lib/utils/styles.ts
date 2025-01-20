export function mergeClasses(defaults: string, overrides: string): string {
    overrides = overrides.trim();
    if (!overrides) return defaults;

    const defaultSet = new Set(defaults.split(/\s+/));
    const overrideSet = new Set(overrides.split(/\s+/));

    // Remove conflicting classes from defaults if they exist in overrides
    for (const override of overrideSet) {
        const [base] = override.split('-'); // Extract the base class (e.g., "flex" from "flex-col")

        // Remove only conflicting specific classes from defaults (e.g., "flex-col", not "flex")
        for (const defaultClass of [...defaultSet]) {
            if (defaultClass !== base && defaultClass.startsWith(base)) {
                defaultSet.delete(defaultClass); // Remove conflicting specific class
            }
        }
    }

    // Combine defaults and overrides
    return [...defaultSet, ...overrideSet].join(' ');
}
