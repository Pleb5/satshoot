<script lang="ts">
    import { marked, type Token, type Tokens, type TokenizerAndRendererExtension } from 'marked';
    import DOMPurify from 'dompurify';
    import ndk from '$lib/stores/session';
    import { NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import hljs from 'highlight.js';
    import 'highlight.js/styles/github-dark.css';
    import type { AddressPointer } from 'nostr-tools/nip19';

    interface Props {
        content?: string;
    }

    let { content = '' }: Props = $props();

    let sanitizedContent = $state('');

    // Helper function to shorten URLs
    function shortenUrl(url: string, text?: string): string {
        // If custom text is provided and it's not the same as URL, use it
        if (text && text !== url) {
            return text;
        }

        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            const pathname = urlObj.pathname;
            
            // Option 1: Domain + shortened path (recommended)
            if (pathname && pathname !== '/') {
                const pathParts = pathname.split('/').filter(Boolean);
                if (pathParts.length > 0) {
                    // Show first part of path, truncate if too long
                    const firstPath = pathParts[0];
                    if (firstPath.length > 20) {
                        return `${domain}/${firstPath.substring(0, 15)}...`;
                    }
                    return `${domain}/${firstPath}${pathParts.length > 1 ? '/...' : ''}`;
                }
            }
            return domain;
            
            // Option 2: First/Last characters (uncomment to use)
            // const fullUrl = url.length > 40 ? `${url.substring(0, 20)}...${url.substring(url.length - 15)}` : url;
            // return fullUrl;
            
            // Option 3: Just domain (uncomment to use)
            // return domain;
            
        } catch (e) {
            // Fallback for invalid URLs
            return url.length > 40 ? `${url.substring(0, 20)}...${url.substring(url.length - 15)}` : url;
        }
    }

    // Helper function to shorten Nostr URIs
    function shortenNostrUri(tagType: string, content: string): string {
        const fullUri = `${tagType}${content}`;
        // Show first 8 and last 8 characters
        return `${fullUri.slice(0, 8)}:${fullUri.slice(-8)}`;
    }

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
                : shortenNostrUri(tagType, content);
            
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
                        const data = nip19.decode(content).data as AddressPointer;
                        if (data.kind === NDKKind.FreelanceJob
                            || data.kind === NDKKind.FreelanceService
                        ) {
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
            const externalAttributes = external ? 'target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${url}" ${externalAttributes} 
                    class="link" title="${tagType}${content}">${linkText}
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
                return `<a href="${url}" class="link">${linkText}</a>`;
            } else {
                return `<a href="${token.href}" class="link">${token.text}</a>`;
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
                const displayText = shortenUrl(href, text);
                return `<a href="${href}" class="link" title="${href}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
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

    $effect(() => {
        if (content) {
            (async () => {
                const parsed = await marked(content);
                sanitizedContent = DOMPurify.sanitize(parsed, { 
                    ADD_ATTR: ['target', 'title']
                });
            })();
        }
    });
</script>

<div class="markdown max-w-full wrap-anywhere overflow-hidden">
    {@html sanitizedContent}
</div>

<style>
    .markdown {
        padding: 1em;
    }
    
    .markdown :global(.link) {
        word-break: break-word;
    }
    
    .markdown :global(.link:hover) {
        text-decoration: underline;
        cursor: pointer;
    }
</style>
