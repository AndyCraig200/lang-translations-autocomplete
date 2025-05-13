import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface TranslationCache {
  keys: string[];
  values: Map<string, string>;
  lastUpdated: number;
}

let translationCache: TranslationCache | null = null;
const CACHE_TIMEOUT = 30000; // 30 seconds

export function activate(context: vscode.ExtensionContext) {
  // Initialize translations when the extension activates
  initializeTranslations().catch(err =>
    console.error('Failed to initialize translations:', err)
  );

  // Register command to open files at specific positions
  let disposable = vscode.commands.registerCommand('lang-translation-autocomplete.openAtPosition',
    async (filePath: string, line: number, character: number) => {
      try {
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);

        const position = new vscode.Position(line, character);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      } catch (error) {
        console.error('Error opening file:', error);
        vscode.window.showErrorMessage(`Failed to open file: ${error}`);
      }
    }
  );
  context.subscriptions.push(disposable);

  // Register completion provider for translation keys
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    ['javascript', 'typescript', 'vue', 'javascriptreact', 'typescriptreact'],
    {
      async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const lineText = document.lineAt(position).text;

        // Detect when cursor is inside quotes
        // For Lang.t() in all files or $t() in .vue files
        let match;

        // Check Lang.t pattern for all files
        const langTRegex = /Lang\s*\.\s*t\s*\(\s*(?:[^,)'"]*,\s*)?(['"`])([^'"]*)?$/;
        match = linePrefix.match(langTRegex);

        // If not found and this is a Vue file, check for $t pattern
        if (!match && document.uri.fsPath.endsWith('.vue')) {
          const vueRegex = /\$t\s*\(\s*(?:[^,)'"]*,\s*)?(['"`])([^'"]*)?$/;
          match = linePrefix.match(vueRegex);
        }

        if (!match) {
          return undefined;
        }

        const translationData = await getTranslationData();
        if (!translationData) {
          return undefined;
        }

        const { keys, values } = translationData;
        const currentInput = match[2] || '';

        // Filter keys based on current input
        const filteredKeys = currentInput ?
          keys.filter(key => key.toLowerCase().includes(currentInput.toLowerCase())) :
          keys;

        // Create completion items for each key
        return filteredKeys.map(key => {
          const completionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Text);
          const value = values.get(key);

          // Fix the replacement range to replace the entire content between quotes
          const quoteChar = match[1]; // The quote character used (', ", or `)
          const startQuotePos = linePrefix.lastIndexOf(quoteChar);
          const endQuotePos = lineText.indexOf(quoteChar, position.character);

          if (startQuotePos !== -1 && endQuotePos !== -1) {
            const startPos = new vscode.Position(position.line, startQuotePos + 1); // +1 to exclude the opening quote
            const endPos = new vscode.Position(position.line, endQuotePos);
            completionItem.range = new vscode.Range(startPos, endPos);
          }

          if (value) {
            completionItem.detail = value;
            completionItem.documentation = new vscode.MarkdownString(`**${key}**: ${value}`);
          }

          return completionItem;
        });
      }
    },
    "'", '"', '`', '.', ' '  // Triggers
  );

  // Register document link provider for translation keys
  const linkProvider = vscode.languages.registerDocumentLinkProvider(
    ['javascript', 'typescript', 'vue', 'javascriptreact', 'typescriptreact'],
    {
      async provideDocumentLinks(document) {
        const links: vscode.DocumentLink[] = [];
        const translationData = await getTranslationData();
        if (!translationData) {
          return links;
        }

        // Find translation function calls in the document
        const text = document.getText();

        // Create patterns for both Lang.t() for all files and $t() for Vue files
        const patterns = [
          // Lang.t() pattern for all files
          /Lang\s*\.\s*t\s*\(\s*(?:[^,)'"]*,\s*)?(['"`])(.*?)(\1)/g
        ];

        // Add $t() pattern only for Vue files
        if (document.uri.fsPath.endsWith('.vue')) {
          patterns.push(/\$t\s*\(\s*(?:[^,)'"]*,\s*)?(['"`])(.*?)(\1)/g);
        }

        // Process all patterns
        for (const regex of patterns) {
          let match;
          while ((match = regex.exec(text)) !== null) {
            const [fullMatch, openQuote, key] = match;

            // Check if this key exists in translations
            if (translationData.values.has(key)) {
              // Calculate positions correctly
              const keyStartIndex = match.index + fullMatch.indexOf(openQuote) + 1;
              const keyEndIndex = keyStartIndex + key.length;

              const startPos = document.positionAt(keyStartIndex);
              const endPos = document.positionAt(keyEndIndex);

              // Ensure the range is valid
              if (endPos.isAfter(startPos)) {
                const range = new vscode.Range(startPos, endPos);
                const translationFile = await findTranslationFile();

                if (translationFile) {
                  // Get the exact position of the key in the translation file
                  const keyPosition = await findKeyPositionInFile(translationFile, key);

                  if (keyPosition) {
                    const commandArgs = [
                      translationFile,
                      keyPosition.line,
                      keyPosition.character
                    ];
                    const uri = vscode.Uri.parse(
                      `command:lang-translation-autocomplete.openAtPosition?${encodeURIComponent(JSON.stringify(commandArgs))}`
                    );

                    const link = new vscode.DocumentLink(range, uri);
                    link.tooltip = `Open translation for "${key}"`;
                    links.push(link);
                  }
                }
              }
            }
          }
        }

        return links;
      }
    }
  );
  context.subscriptions.push(linkProvider);
  context.subscriptions.push(completionProvider);

  // Find the position of a translation key in the translation file
  async function findKeyPositionInFile(filePath: string, key: string): Promise<{ line: number, character: number } | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Since keys are stored as flat strings like "probate.this-tool-provides", 
      // we need to search for the exact key in the file

      // Look for the key pattern in the file (either with quotes or without)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for "key": or "key" : pattern
        const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); // Escape special regex chars
        const keyPattern = new RegExp(`"${escapedKey}"\\s*:`);
        const match = line.match(keyPattern);

        if (match) {
          // Found the key, return its position
          const character = match.index !== undefined ? match.index : line.indexOf(`"${key}"`);
          return { line: i, character };
        }
      }

      // If not found with exact match, try to search for just the key in line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(`"${key}"`)) {
          const character = line.indexOf(`"${key}"`);
          return { line: i, character };
        }
      }

      return null;
    } catch (error) {
      console.error(`Error finding key position: ${error}`);
      return null;
    }
  }

  // Helper function to find the translation file path
  async function findTranslationFile(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return null;
    }

    // Use common locations for translation files
    let enJsonPath: string | null = null;
    const commonLocations = [
      'src/locales/en.json',
      'client/src/locales/en.json',
      'locales/en.json',
    ];

    for (const folder of workspaceFolders) {
      for (const location of commonLocations) {
        const filePath = path.join(folder.uri.fsPath, location);
        if (fs.existsSync(filePath)) {
          enJsonPath = filePath;
          break;
        }
      }
      if (enJsonPath) break;
    }

    // If not found in common locations, try through file search
    if (!enJsonPath) {
      const files = await vscode.workspace.findFiles('**/en.json', '**/node_modules/**', 1);
      if (files.length > 0) {
        enJsonPath = files[0].fsPath;
      }
    }

    return enJsonPath;
  }

  // Refresh cache when en.json changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/en.json');
  watcher.onDidChange(() => { translationCache = null; });
  watcher.onDidCreate(() => { translationCache = null; });
  watcher.onDidDelete(() => { translationCache = null; });

  context.subscriptions.push(watcher);
}

async function initializeTranslations(): Promise<void> {
  await getTranslationData();
}

async function getTranslationData(): Promise<{ keys: string[], values: Map<string, string> } | null> {
  // Check if cache is valid
  const now = Date.now();
  if (translationCache && now - translationCache.lastUpdated < CACHE_TIMEOUT) {
    return { keys: translationCache.keys, values: translationCache.values };
  }

  try {
    // Find en.json in the workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return null;
    }

    // Try to find en.json in common locations
    let enJsonPath: string | null = null;
    const commonLocations = [
      'src/locales/en.json',
      'client/src/locales/en.json',
      'locales/en.json',
      'translations/en.json',
      'i18n/en.json'
    ];

    for (const folder of workspaceFolders) {
      for (const location of commonLocations) {
        const filePath = path.join(folder.uri.fsPath, location);
        if (fs.existsSync(filePath)) {
          enJsonPath = filePath;
          break;
        }
      }
      if (enJsonPath) break;
    }

    // If not found in common locations, try through file search
    if (!enJsonPath) {
      const files = await vscode.workspace.findFiles('**/en.json', '**/node_modules/**', 1);
      if (files.length > 0) {
        enJsonPath = files[0].fsPath;
      }
    }

    if (!enJsonPath) {
      vscode.window.showWarningMessage('Could not find en.json file in the workspace');
      return null;
    }

    return loadAndCacheTranslations(enJsonPath);
  } catch (error) {
    console.error('Error loading translation keys:', error);
    vscode.window.showErrorMessage('Error loading translation keys');
    return null;
  }
}

function loadAndCacheTranslations(filePath: string): { keys: string[], values: Map<string, string> } | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Remove comments to ensure valid JSON
    const jsonContent = content.replace(/^\s*\/\/.*$/gm, '');

    const translations = JSON.parse(jsonContent);

    // Flatten the nested translations
    const keys: string[] = [];
    const values = new Map<string, string>();

    flattenTranslations(translations, '', keys, values);

    // Cache the results
    translationCache = {
      keys,
      values,
      lastUpdated: Date.now()
    };

    return { keys, values };
  } catch (error) {
    console.error('Error parsing en.json:', error);
    return null;
  }
}

function flattenTranslations(
  obj: any,
  prefix: string = '',
  keys: string[],
  values: Map<string, string>
): void {
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const compositeKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      // Recursively flatten nested objects
      flattenTranslations(obj[key], compositeKey, keys, values);
    } else {
      keys.push(compositeKey);
      values.set(compositeKey, String(obj[key]));
    }
  }
}

export function deactivate() { }