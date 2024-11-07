<script lang="ts">
    import { marked, type Tokens, type TokenizerAndRendererExtension } from 'marked';
    import markedLinkifyIt from 'marked-linkify-it';
    import DOMPurify from 'dompurify';

    export let content = '';

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
                    tokens: [],
                };
            }
        },
        renderer(token: Tokens.Generic) {
            const { prefix, tagType, content, text } = token;

            // Customize rendering based on the tag type
            let additionalClass = '';
            let icon = '';

            switch (tagType) {
                case 'nevent':
                    additionalClass = 'nostr-nevent';
                    icon = '<i class="icon-nevent"></i> ';
                    break;
                case 'note':
                    additionalClass = 'nostr-note';
                    icon = '<i class="icon-note"></i> ';
                    break;
                case 'npub':
                    additionalClass = 'nostr-npub';
                    icon = '<i class="icon-npub"></i> ';
                    break;
                case 'nprofile':
                    additionalClass = 'nostr-nprofile';
                    icon = '<i class="icon-nprofile"></i> ';
                    break;
                case 'naddr':
                    additionalClass = 'nostr-naddr';
                    icon = '<i class="icon-naddr"></i> ';
                    break;
            }

            return `<span class="nostr-handle ${additionalClass}">${token.text}</span>`;
        },
    };

    marked.use({
        renderer: {
            image() {
                return false;
            },
        },
    });

    marked.use({ extensions: [nostrTokenizer] });
    marked.use(markedLinkifyIt({}, {}));

    const sanitizedContent = DOMPurify.sanitize(marked(content));
</script>

<div class="markdown">{@html sanitizedContent}</div>
