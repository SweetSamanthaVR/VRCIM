/**
 * Internationalization (i18n) Client Library
 * Handles loading and applying translations on the frontend
 */

console.log('i18n.js loading...');

class I18n {
    constructor() {
        this.translations = {};
        this.currentLanguage = 'en';
        this.fallbackLanguage = 'en';
        this.ready = false;
    }

    /**
     * Initialize i18n system
     * @param {string} lang - Language code to load
     */
    async init(lang = null) {
        // Detect language from HTML lang attribute or use provided
        this.currentLanguage = lang || document.documentElement.lang || this.detectBrowserLanguage();
        
        console.log('i18n initializing with language:', this.currentLanguage);
        
        try {
            await this.loadTranslations(this.currentLanguage);
            this.applyTranslations();
            this.ready = true;
            console.log(`🌍 Loaded language: ${this.currentLanguage}`);
            console.log('i18n ready, dispatching event');
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('i18nReady'));
        } catch (error) {
            console.error('Failed to initialize i18n:', error);
            // Fallback to English if loading fails
            if (this.currentLanguage !== this.fallbackLanguage) {
                await this.loadTranslations(this.fallbackLanguage);
                this.applyTranslations();
            }
        }
    }

    /**
     * Detect browser language
     */
    detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        return browserLang.split('-')[0]; // Get base language (e.g., 'en' from 'en-US')
    }

    /**
     * Load translations from server
     * @param {string} lang - Language code
     */
    async loadTranslations(lang) {
        const response = await fetch(`/api/translations/${lang}`);
        if (!response.ok) {
            throw new Error(`Failed to load translations for ${lang}`);
        }
        const data = await response.json();
        this.translations = data.translations;
    }

    /**
     * Get translation by key path
     * @param {string} key - Dot-notation key path (e.g., 'common.loading')
     * @param {object} variables - Variables to interpolate
     * @returns {string}
     */
    t(key, variables = {}) {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }
        
        if (typeof value !== 'string') {
            console.warn(`Translation key is not a string: ${key}`);
            return key;
        }
        
        // Simple variable interpolation
        return value.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
            return variables[variable] !== undefined ? variables[variable] : match;
        });
    }

    /**
     * Apply translations to DOM elements with data-i18n attribute
     */
    applyTranslations() {
        // Handle elements with data-i18n for text content
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            // Check if we should update text content or title
            if (element.hasAttribute('data-i18n-title')) {
                element.title = translation;
            } else {
                element.textContent = translation;
            }
        });
        
        // Handle elements with data-i18n-placeholder for placeholder attribute
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            element.placeholder = translation;
        });
    }

    /**
     * Change language at runtime
     * @param {string} lang - New language code
     */
    async changeLanguage(lang) {
        this.currentLanguage = lang;
        await this.loadTranslations(lang);
        this.applyTranslations();
        
        // Update HTML lang attribute
        document.documentElement.lang = lang;
        
        // Store preference
        localStorage.setItem('preferred-language', lang);
        
        // Dispatch event for custom handlers
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }

    /**
     * Get available languages from server
     */
    async getAvailableLanguages() {
        const response = await fetch('/api/languages');
        if (!response.ok) {
            throw new Error('Failed to fetch available languages');
        }
        const data = await response.json();
        return data.languages;
    }
}

// Create global instance
console.log('Creating i18n instance...');
window.i18n = new I18n();
console.log('i18n instance created:', window.i18n);

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const savedLang = localStorage.getItem('preferred-language');
        window.i18n.init(savedLang);
    });
} else {
    const savedLang = localStorage.getItem('preferred-language');
    window.i18n.init(savedLang);
}
