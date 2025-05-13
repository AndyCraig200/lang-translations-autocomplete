# Lang Translation Autocomplete

A VS Code extension that provides autocomplete suggestions for translation keys in `Lang.t()` function calls. It helps developers work more efficiently with translation files by providing instant access to available translation keys and their values.


## Features

- **Automatic Translation Key Detection**: Automatically detects when you're typing inside a `Lang.t()` function call
- **Intelligent Suggestions**: Shows translation keys matching your current input
- **Translation Preview**: Displays the actual translation value alongside each suggestion
- **Nested Translation Support**: Fully supports nested translation objects with dot notation
- **Real-time Updates**: Automatically refreshes when translation files change

## Installation

### Local Installation

1. Download the `.vsix` file from the releases page
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
4. Click "..." at the top of Extensions view and select "Install from VSIX..."
5. Select the downloaded `.vsix` file

### Via VS Code Marketplace

_Coming soon!_

## Usage

This extension automatically activates when editing JavaScript, TypeScript, Vue, JSX, or TSX files.

1. Begin typing a `Lang.t()` call with quotes
2. Translation suggestions will appear automatically
3. Press Tab or Enter to insert the selected translation key

Example:
```javascript
// Start typing:
Lang.t('us

// Suggestions might include:
// user.profile.name
// user.settings.title
// user.login.error