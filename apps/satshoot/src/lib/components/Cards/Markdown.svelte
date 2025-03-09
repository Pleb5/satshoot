<script lang="ts">
    import { marked, type Token, type Tokens, type TokenizerAndRendererExtension } from 'marked';
    import DOMPurify from 'dompurify';
    import ndk from '$lib/stores/ndk';
    import { NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import hljs from 'highlight.js';
    import 'highlight.js/styles/github-dark.css'; // Choose your preferred style
    import type { AddressPointer } from 'nostr-tools/nip19';

    export let content = '';

    let sanitizedContent = '';

    const getPub = async (token: Token) => {
        if (token.type === 'nostr') {
            const id = `${token.tagType}${token.content}`;
            const { type, data } = nip19.decode(id);
            let pubkey = '';
            switch (type) {
                case 'nprofile':
                    pubkey = data.pubkey;
                    break;
                case 'npub':
                    pubkey = data;
                    break;
                default:
                    return;
            }
            let user = $ndk.getUser({ hexpubkey: pubkey });
            token.npub = user.npub;

            try {
                const profile = await user.fetchProfile({
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    closeOnEose: true,
                    groupable: true,
                    groupableDelay: 1000,
                });
                if (profile) {
                    token.userName = profile.name || profile.displayName;
                }
            } catch (e) {
                console.error(e);
            }
        } else if (token.type === 'email') {
            try {
                const user = await $ndk.getUserFromNip05(token.text);
                if (user) {
                    token.isNip05 = true;
                    token.tagType = 'npub';
                    token.content = user.npub;
                    // Fetch user profile
                    const profile = await user.fetchProfile({
                        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                        closeOnEose: true,
                        groupable: true,
                        groupableDelay: 1000,
                    });
                    if (profile) {
                        token.userName = profile.name || profile.displayName || token.text;
                    } else {
                        token.userName = token.text;
                    }
                }
            } catch (e) {
                console.error(`Failed to fetch NIP-05 user for ${token.text}:`, e);
                token.isNip05 = false;
            }
        }
    };

    const nostrRegex = /^(nostr:)?n(event|ote|pub|profile|addr)([a-zA-Z0-9]{10,1000})/;
    const nostrTokenizer: TokenizerAndRendererExtension = {
        name: 'nostr',
        level: 'inline',
        start(src: string) {
            const match = src.match(/(nostr:)?n(event|ote|pub|profile|addr)/);
            return match ? match.index : -1;
        },
        tokenizer(src: string) {
            const match = nostrRegex.exec(src);
            if (match) {
                const [fullMatch, prefix, tagType, content] = match;
                return {
                    type: 'nostr',
                    raw: fullMatch,
                    text: fullMatch,
                    tagType: `n${tagType}`,
                    prefix: prefix || '',
                    content,
                    userName: null,
                    tokens: [],
                };
            }
        },
        renderer(token: Tokens.Generic) {
            const { tagType, content, userName } = token;
            let url = `/${tagType}${content}`;
            let external = false;
            let linkText = userName
                ? `@${userName}`
                : `${(tagType + content).slice(0, 10)}:${(tagType + content).slice(-10)}`;
            switch (tagType) {
                case 'nevent':
                case 'note':
                    url = `https://coracle.social/notes/${tagType}${content}`;
                    external = true;
                    break;
                case 'nprofile':
                    external = true;
                    url = `https://coracle.social/people/${tagType}${content}`;
                    break;
                case 'npub':
                    break;
                case 'naddr':
                    try {
                        const data = nip19.decode(content).data as AddressPointer
                        if (data.kind === NDKKind.FreelanceTicket) {
                            url = `/${tagType}${content}`;
                        } else {
                            external = true;
                            url = `https://coracle.social/${tagType}${content}`;
                        }
                    } catch (err) {
                        break;
                    }
                    break;
            }
            const externalAttributes = external
                ? 'target="_blank" rel="noopener noreferrer"'
                : ""
            return `<a href="${url}" ${externalAttributes} 
                    class="text-blue-600 hover:text-blue-800 hover:underline">${linkText}
                    </a>`;
        },
    };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+/;
    const emailTokenizer: TokenizerAndRendererExtension = {
        name: 'email',
        level: 'inline',
        start(src: string) {
            const match = src.match(emailRegex);
            return match ? match.index : -1;
        },
        tokenizer(src: string) {
            const match = emailRegex.exec(src);
            if (match) {
                const [fullMatch] = match;
                return {
                    type: 'email',
                    raw: fullMatch,
                    text: fullMatch,
                    href: `mailto:${fullMatch}`,
                    isNip05: false,
                    tokens: [],
                };
            }
        },
        renderer(token: Tokens.Generic) {
            if (token.isNip05) {
                // Render as Nostr link
                const { tagType, content, userName } = token;
                let url = `/${content}`;
                let linkText = userName ? `@${userName}` : token.text;
                return `<a href="${url}" class="text-blue-600 hover:text-blue-800 hover:underline">${linkText}</a>`;
            } else {
                return `<a href="${token.href}" class="text-blue-600 hover:text-blue-800 hover:underline">${token.text}</a>`;
            }
        },
    };

    marked.use({
        extensions: [nostrTokenizer, emailTokenizer],
        async: true,
        breaks: true,
        walkTokens: getPub,
        renderer: {
            image() {
                return '';
            },
            link(token) {
                const { href, text } = token;

                return `<a href="${href}" class="text-blue-600 hover:text-blue-800 hover:underline">${text}</a>`;
            },
            list(token) {
                const listItems = token.items
                    .map((item) => {
                        const itemContent = this.parser.parseInline(item.tokens);
                        return `<li>${itemContent}</li>`;
                    })
                    .join('\n');

                const listClass = token.ordered
                    ? 'list-decimal list-inside'
                    : 'list-disc list-inside';

                return token.ordered
                    ? `<ol class="${listClass}">${listItems}</ol>`
                    : `<ul class="${listClass}">${listItems}</ul>`;
            },
            code(token) {
                const validLang = token.lang || 'plaintext';
                const highlightedCode = hljs.highlight(token.text, {
                    language: validLang,
                }).value;

                return `
                    <pre class="hljs"><code class="language-${validLang}">${highlightedCode}</code></pre>
                `;
            },
        },
    });

    $: if (content) {
        (async () => {
            const parsed = await marked(content);
            sanitizedContent = DOMPurify.sanitize(parsed, {ADD_ATTR: ['target']});
        })();
    }
</script>

<div class="markdown">{@html sanitizedContent}</div>

<style>
    .markdown {
        padding: 1em;
    }
</style>
