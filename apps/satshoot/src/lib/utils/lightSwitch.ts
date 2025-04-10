/** Get the OS preference for light/dark mode */
export function getModeOsPrefers() {
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDarkMode ? 'dark' : 'light';
}

/** Get the User's preference for light/dark mode */
export function getModeUserPrefers() {
    return localStorage.getItem('mode');
}

/** Set the User's preference for light/dark mode */
export function setModeUserPrefers(mode: string) {
    return localStorage.setItem('mode', mode);
}
