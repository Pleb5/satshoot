<script lang="ts">
    import { marked, type Token, type Tokens, type TokenizerAndRendererExtension } from 'marked';
    import markedLinkifyIt from 'marked-linkify-it';
    import DOMPurify from 'dompurify';
    import ndk from '$lib/stores/ndk';
    import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import { nip19 } from 'nostr-tools';

    export let content = '';
    let sanitizedContent = '';

    const getPub = async (token: Token) => {
        if (token.type === 'nostr') {

			const id = `${token.tagType}${token.content}`;
			const {type, data} = nip19.decode(id);
			let npub = '';
            
			switch(type) {
				case 'nevent':
                case 'note':
                case 'naddr':
					return;
				case 'nprofile':
					npub = data.pubkey;
					break;
				case 'npub':
					npub = data;
					break;
			}

			let user = $ndk.getUser({ pubkey: npub });

            try {
                const profile = await user.fetchProfile({
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    closeOnEose: true,
                    groupable: true,
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
            const { prefix, tagType, content, text, userName } = token;
            switch (tagType) {
                case 'nevent':
                case 'note':
                case 'naddr':
                    return `<a href="/${tagType}${content}" class="nostr-handle">
					    ${content.slice(0, 10) + '...'}
					</a>`;
                case 'nprofile':
                case 'npub':
                    return `<a href="/${tagType}${content}">
                        @${userName ? userName : content.slice(0, 10) + '...'}
                    </a>`;
            }
        },
    };

    marked.use({ extensions: [nostrTokenizer], async: true, walkTokens: getPub });
    marked.use(markedLinkifyIt({}, {}));
    marked.use({
        renderer: {
            image() {
                return '';
            },
        },
    });

    onMount(async () => {
        sanitizedContent = DOMPurify.sanitize(await marked(content));
    });
</script>

<div class="markdown">{@html sanitizedContent}</div>

<style>
    .markdown {
        padding: 1em;
    }
</style>
