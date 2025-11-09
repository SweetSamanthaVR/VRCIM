# Localization System Implementation

## Overview

VRCIM now includes a complete internationalization (i18n) system that allows the application to display content in multiple languages. The system automatically detects the user's browser language and falls back to English if the requested language is not available.

## Architecture

### Backend Components

1. **`src/localization.ts`** - Core localization service
   - Loads translation files from the `languages/` directory
   - Detects browser language from HTTP Accept-Language header
   - Provides translations via REST API endpoints
   - Auto-generates default English translations if no language files exist

2. **API Endpoints**
   - `GET /api/languages` - Returns list of available languages
   - `GET /api/translations/:lang` - Returns translations for a specific language

3. **Configuration**
   - `DEFAULT_LANGUAGE` environment variable (defaults to 'en')
   - Added to `AppConfig` interface in `src/config.ts`

### Frontend Components

1. **`public/js/i18n.js`** - Client-side i18n library
   - Automatically initializes on page load
   - Fetches translations from server
   - Applies translations to DOM elements with `data-i18n` attributes
   - Supports variable interpolation (e.g., `{{username}}`)
   - Stores language preference in localStorage
   - Provides `window.i18n` global API

2. **View Templates**
   - All EJS templates updated with `lang` attribute
   - i18n.js script included in all pages
   - Ready for `data-i18n` attribute usage

## Usage

### For Developers

#### Adding Translatable Text in HTML

```html
<!-- Simple text translation -->
<h1 data-i18n="monitor.title">VRChat Instance Monitor</h1>

<!-- Placeholder translation -->
<input type="text" data-i18n-placeholder placeholder="Search..." data-i18n="users.searchPlaceholder">

<!-- Title attribute translation -->
<button data-i18n-title title="Refresh" data-i18n="common.refresh">🔄</button>
```

#### Adding Translatable Text in JavaScript

```javascript
// Get translation
const loadingText = window.i18n.t('common.loading');

// Get translation with variables
const greeting = window.i18n.t('user.greeting', { username: 'Alice' });

// Change language at runtime
await window.i18n.changeLanguage('es');

// Get available languages
const languages = await window.i18n.getAvailableLanguages();
```

### For Translators

#### Creating a New Language File

1. Navigate to the `languages/` directory
2. Copy `en.json` as a template
3. Rename to your language code (e.g., `fr.json` for French, `es.json` for Spanish)
4. Update the `_meta` section:

```json
{
  "_meta": {
    "name": "Français",
    "code": "fr",
    "contributors": "Your Name"
  },
  ...
}
```

5. Translate all string values (keep keys in English)
6. Test by setting `DEFAULT_LANGUAGE=fr` in `.env`
7. Submit a pull request!

#### Translation Guidelines

- **Keep keys unchanged** - Only translate the values
- **Preserve placeholders** - Keep `{{variable}}` intact
- **Maintain structure** - Keep the same JSON hierarchy
- **Test thoroughly** - Run the app before submitting
- **Handle special characters** - UTF-8 encoding is supported

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Default language code (ISO 639-1)
DEFAULT_LANGUAGE=en
```

### Supported Languages

The system automatically detects and loads any `.json` files in the `languages/` directory. Currently available:

- **English (en)** - Default, auto-generated

## Translation Keys Structure

```
common.*           - Common UI elements (buttons, labels)
nav.*             - Navigation menu items
monitor.*         - Dashboard/monitor page
users.*           - Users list page
userDetails.*     - User profile page
login.*           - Login page
errors.*          - Error messages
success.*         - Success messages
```

## Browser Language Detection

The system detects language in this order:

1. **localStorage** - Saved user preference from previous session
2. **Accept-Language header** - Browser's preferred language
3. **DEFAULT_LANGUAGE** - Environment variable (default: 'en')
4. **Fallback** - English ('en') if all else fails

## API Reference

### Backend API

```typescript
// Get available languages
GET /api/languages
Response: { languages: [{ code: string, name: string }] }

// Get translations for a language
GET /api/translations/:lang
Response: { translations: Translations }
```

### Frontend API

```javascript
// Initialize i18n (called automatically)
await window.i18n.init(lang?);

// Get translation
window.i18n.t(key, variables?)

// Change language
await window.i18n.changeLanguage(lang)

// Get available languages
await window.i18n.getAvailableLanguages()

// Apply translations to DOM
window.i18n.applyTranslations()
```

## File Structure

```
VRCIM/
├── languages/              # Translation files
│   ├── README.md          # Contribution guide
│   └── en.json            # English translations (auto-generated)
├── src/
│   ├── localization.ts    # Backend localization service
│   └── config.ts          # Added defaultLanguage config
├── public/js/
│   └── i18n.js            # Frontend i18n library
└── views/
    ├── index.ejs          # Updated with lang attribute
    ├── login.ejs          # Updated with lang attribute
    ├── users.ejs          # Updated with lang attribute
    └── user-details.ejs   # Updated with lang attribute
```

## Contributing Translations

Community contributions are welcome! See `languages/README.md` for detailed instructions on how to contribute translations.

### Quick Start for Contributors

1. Fork the repository
2. Create a new language file in `languages/` (e.g., `de.json`)
3. Translate all strings
4. Test locally
5. Submit a pull request

## Examples

### Example Translation File (French)

```json
{
  "_meta": {
    "name": "Français",
    "code": "fr",
    "contributors": "Jean Dupont"
  },
  "common": {
    "loading": "Chargement...",
    "error": "Erreur",
    "success": "Succès"
  },
  "monitor": {
    "title": "Moniteur d'Instance VRChat",
    "currentWorld": "Monde Actuel"
  }
}
```

## Future Enhancements

- [ ] Language selector in UI
- [ ] Pluralization support
- [ ] Date/time localization
- [ ] Number formatting
- [ ] RTL language support
- [ ] Translation validation tool
- [ ] Automatic translation suggestions

## Troubleshooting

### Language not loading

1. Check that the `.json` file is in `languages/` directory
2. Verify JSON syntax is valid
3. Check server logs for errors
4. Clear browser cache and localStorage

### Translations not appearing

1. Ensure `data-i18n` attributes are correct
2. Check browser console for errors
3. Verify translation keys exist in language file
4. Reload the page to re-initialize i18n

### Creating new translation keys

1. Add to `en.json` in `languages/` directory
2. Rebuild if modifying default translations in code
3. Add `data-i18n` attributes to HTML elements
4. Test with different languages

## Support

For questions or issues with localization:
- Open an issue on GitHub
- Check `languages/README.md` for contributor guidelines
- Review the example English translation file

---

**Note**: The localization system is designed to be lightweight and community-driven. All translations are stored as simple JSON files that can be easily edited and contributed by anyone.
