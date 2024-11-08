<script lang="ts">
    import { marked, type Token, type Tokens, type TokenizerAndRendererExtension } from 'marked';
    import markedLinkifyIt from 'marked-linkify-it';
    import DOMPurify from 'dompurify';
    import ndk from '$lib/stores/ndk';
    import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';

    export let content = '';
    let sanitizedContent = '';

    const getPub = async (token: Token) => {
        if (token.type === 'nostr' && token.tagType === 'npub') {
            const user = $ndk.getUser({ npub: token.tagType + token.content });

            try {
                const profile = await user.fetchProfile({
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    closeOnEose: true,
                    groupable: false,
                    groupableDelay: 1000,
                });
                if (profile) {
                    if (profile.name) token.userName = profile.name;
                }
            } catch (e) {
				console.log(e);
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
        tokenizer(src: string, tokens: any) {
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
            const { prefix, tagType, content, text } = token;
            switch (tagType) {
                case 'nevent':
                case 'note':
                case 'naddr':
                    return `<a href="/${token.tagType}${token.content}" class="nostr-handle">
					    ${token.content.slice(0, 10) + '...'}
					</a>`;
                case 'nprofile':
                case 'npub':
                    return `<a href="/${token.tagType}${token.content}">
                        @${token.userName ? token.userName : token.content.slice(0, 10) + '...'}
                    </a>`;
            }
        },
    };

    marked.use({
        renderer: {
            image() {
                return false;
            },
        },
    });
    marked.use({ extensions: [nostrTokenizer], async: true, walkTokens: getPub });
    marked.use(markedLinkifyIt({}, {}));

    onMount(async () => {
        sanitizedContent = DOMPurify.sanitize(await marked(content));
    });
</script>

<div class="markdown">{@html sanitizedContent}</div>
