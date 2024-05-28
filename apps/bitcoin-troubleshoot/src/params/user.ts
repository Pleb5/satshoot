/** @type {import('@sveltejs/kit').ParamMatcher} */

export function match(param:string) {
    // Don't match nprofile for now
    return /^^(npub1)[a-zA-Z0-9]*/.test(param);
}
