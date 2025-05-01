/**
 * Service for handling UI-related functionality
 */
export class UIService {
    // Public state for direct access with runes
    contactsOpen = $state<boolean>(false);
    disablePrompt = $state<boolean>(false);
    hideChat = $state<boolean>(false);
    hideSearchIcon = $state<boolean>(false);
    mounted = $state<boolean>(false);
    chatHeight = $state<number>(300);

    // UI element references (private since they're only used internally)
    private headerElement = $state<HTMLElement | null>(null);
    private chatElement = $state<HTMLElement | null>(null);
    private inputElement = $state<HTMLElement | null>(null);
    private contactsMobileViewElement = $state<HTMLElement | null>(null);
    private pageElement = $state<HTMLElement | null>(null);

    constructor() {
        // Initialize UI state
        this.mounted = true;
    }

    /**
     * Set the header element reference
     */
    setHeaderElement(element: HTMLElement) {
        this.headerElement = element;
        this.updateChatHeight();
    }

    /**
     * Set the chat element reference
     */
    setChatElement(element: HTMLElement) {
        this.chatElement = element;
    }

    /**
     * Set the input element reference
     */
    setInputElement(element: HTMLElement) {
        this.inputElement = element;
        this.updateChatHeight();
    }

    /**
     * Set the contacts mobile view element reference
     */
    setContactsMobileViewElement(element: HTMLElement) {
        this.contactsMobileViewElement = element;
    }

    /**
     * Set the page element reference
     */
    setPageElement(element: HTMLElement) {
        this.pageElement = element;
        this.updateChatHeight();
    }

    /**
     * Set the contacts open state
     */
    setContactsOpen(open: boolean) {
        this.contactsOpen = open;

        // Update related UI states
        if (open) {
            this.onContactListExpanded();
        } else {
            this.onContactListCollapsed();
        }
    }

    /**
     * Handle contact list expanded
     */
    private onContactListExpanded() {
        this.hideChat = true;
        this.disablePrompt = true;
        this.hideSearchIcon = true;
    }

    /**
     * Handle contact list collapsed
     */
    private onContactListCollapsed() {
        this.hideChat = false;
        this.disablePrompt = false;
        this.hideSearchIcon = false;
    }

    /**
     * Update chat height based on available space
     */
    private updateChatHeight() {
        if (!this.pageElement || !this.headerElement || !this.inputElement || !this.chatElement) {
            return;
        }

        // Calculate available height for chat
        const pageHeight = this.pageElement.clientHeight;
        const headerHeight = this.headerElement.clientHeight;
        const inputHeight = this.inputElement.clientHeight;
        const availableHeight = pageHeight - headerHeight - inputHeight - 40; // 40px for padding/margins

        // Update chat height
        this.chatHeight = Math.max(300, availableHeight);
    }

    /**
     * Scroll chat to bottom
     */
    scrollChatBottom(behavior: ScrollBehavior = 'auto') {
        if (this.chatElement) {
            this.chatElement.scrollTo({
                top: this.chatElement.scrollHeight,
                behavior,
            });
        }
    }
}
