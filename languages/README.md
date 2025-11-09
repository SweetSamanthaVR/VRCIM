# VRCIM Language Files

This directory contains translation files for VRCIM. Community contributions are welcome!

## File Structure

Each language is a JSON file named with its ISO 639-1 language code:
- `en.json` - English (default)
- `es.json` - Spanish
- `fr.json` - French
- `de.json` - German
- `ja.json` - Japanese
- etc.

## Contributing a Translation

1. Copy `en.json` as a starting template
2. Rename it to your language code (e.g., `fr.json` for French)
3. Update the `_meta` section with your language info
4. Translate all string values (keep the keys in English)
5. Test your translation by setting `DEFAULT_LANGUAGE` in `.env`
6. Submit a pull request!

## Translation Guidelines

- Keep formatting placeholders intact (e.g., `{{username}}`)
- Maintain the same JSON structure
- Don't translate keys, only values
- Keep special characters like emojis (👥, 🔔, etc.) or translate them if culturally appropriate
- Test in the application before submitting

## Example Translation

```json
{
  "_meta": {
    "name": "Français",
    "code": "fr",
    "contributors": ["YourName"]
  },
  "common": {
    "loading": "Chargement...",
    "error": "Erreur",
    "success": "Succès"
  }
}
```

## Testing Your Translation

1. Add your language file to the `languages/` directory
2. Set `DEFAULT_LANGUAGE=your_code` in `.env`
3. Restart the server: `npm run build && npm start`
4. Your language should automatically load

## Questions?

Open an issue on GitHub if you need help or have questions about translating VRCIM!
