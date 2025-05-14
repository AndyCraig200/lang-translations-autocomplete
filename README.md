# Lang Translation Autocomplete


A VS Code extension built specifically for Clearestate developers that provides intelligent autocomplete suggestions for translation keys in `Lang.t()` function calls. This tool streamlines our multilingual development workflow by providing instant access to available translation keys and their corresponding values.

## Features

- **Translation Key Autocomplete**: Get intelligent suggestions as you type inside `Lang.t()` function calls
- **Translation Preview**: See the actual translation text alongside each suggestion
- **Document Links**: Click on translation keys to jump directly to their definition in translation files
- **Nested Key Navigation**: Fully supports navigation through nested translation objects using dot notation
- **Real-time Updates**: Suggestions automatically refresh when translation files are modified
- **Clearestate-specific**: Optimized for our project structure and translation conventions

## Installation

This extension is for internal use at Clearestate and is not published to the VS Code Marketplace.

### Installation Steps

1. Download the latest `.vsix` file from the [GitHub Releases page](https://github.com/clearestate/clearestate-translations-autocomplete/releases)
2. Open VS Code
3. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
4. Click the `...` menu (top-right of Extensions panel)
5. Select "Install from VSIX..."
6. Choose the downloaded `.vsix` file
7. Restart VS Code if prompted

## Usage

The extension activates automatically when you open JavaScript, TypeScript, Vue, JSX, or TSX files in our project.

### Basic Usage

1. Start typing a translation key inside a `Lang.t()` call:
   ```javascript
   Lang.t('')
2. Browse and select from available translation keys:
    ```javascript
    // As you type 'comm', you'll see suggestions like:
    Lang.t('common.buttons.save')
    Lang.t('common.errors.required')
3. Press tab or enter to complete the selection
### Navigation

- Quick Navigation: Click on any translation key in your code to jump to its definition in the translation files
- Hover Preview: Hover over a translation key to see its current value without leaving your file

### Project Structure Requirements
This extension expects:

- Translation files (JSON format) in a /locales directory
- Translation objects with dot notation paths (e.g., common.buttons.save)
- Lang.t() function calls for translation key references