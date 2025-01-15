<script lang="ts">
    export let classes = '';

    const defaultClasses =
        'w-full flex flex-col gap-[5px] rounded-[8px] p-[15px] ' +
        'shadow-[0_0_4px_0_rgba(0,0,0,0.1)] bg-white';

    // Merge defaultClasses and classes, ensuring classes take precedence
    $: finalClasses = mergeClasses(defaultClasses, classes);

    // Function to merge classes with priority to user-provided classes
    function mergeClasses(defaults: string, overrides: string): string {
        overrides = overrides.trim();
        if (!overrides) return defaults;

        const defaultSet = new Set(defaults.split(/\s+/));
        const overrideSet = new Set(overrides.split(/\s+/));

        console.log('final Default Set:', [...defaultSet]);
        console.log('final Override Set:', [...overrideSet]);

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

    $: console.log('finalClasses :>> ', finalClasses);
</script>

<div class={finalClasses}>
    <slot></slot>
</div>
