#!/bin/bash

directory_root="./packages/ndk"
subfolders=("ndk" "ndk-cache-dexie" "ndk-cache-redis" "ndk-svelte" "ndk-svelte-components")

for subfolder in "${subfolders[@]}"; do
    current_folder="$directory_root/$subfolder"

    if [ -d "$current_folder" ]; then
        cd "$current_folder"
        pnpm run build
        cd - >/dev/null
    else
        echo "Subfolder $subfolder not found in $directory_root; you need to checkout the git submodules. Run: \"just update\""
    fi
done
