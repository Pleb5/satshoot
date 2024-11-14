<script lang="ts">
    import { marked, type Token, type Tokens, type TokenizerAndRendererExtension } from 'marked';
    import DOMPurify from 'dompurify';
    import ndk from '$lib/stores/ndk';
    import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';

    export let content = '';
    let sanitizedContent = '';

    const getPub = async (token: Token) => {
        if (token.type === 'nostr') {
            const id = `${token.tagType}${token.content}`;
            const { type, data } = nip19.decode(id);
            let npub = '';

            switch (type) {
                case 'nprofile':
                    npub = data.pubkey;
                    break;
                case 'npub':
                    npub = data;
                    break;
                default:
                    return;
            }

            let user = $ndk.getUser({ hexpubkey: npub });

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
            let linkText = userName ? `@${userName}` : `${tagType}${content}`.slice(0, 20) + '...';

            switch (tagType) {
                case 'nevent':
                case 'note':
                    url = `https://coracle.social/notes/${tagType}${content}`;
                    break;
                case 'nprofile':
                    url = `https://coracle.social/people/${tagType}${content}`;
                    break;
                case 'npub':
                case 'naddr':
                    break;
            }
            return `<a href="${url}">${linkText}</a>`;
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
                return `<a href="${url}">${linkText}</a>`;
            } else {
                return `<a href="${token.href}">${token.text}</a>`;
            }
        },
    };

    marked.use({
        extensions: [nostrTokenizer, emailTokenizer],
        async: true,
        walkTokens: getPub,
        renderer: {
            image() {
                return '';
            },
        },
    });

    $: if (content) {
        (async () => {
            const parsed = await marked(content);
            sanitizedContent = DOMPurify.sanitize(parsed);
        })();
    }
</script>

<div class="markdown">{@html sanitizedContent}</div>

<style>
    .markdown {
        padding: 1em;
    }
</style>
