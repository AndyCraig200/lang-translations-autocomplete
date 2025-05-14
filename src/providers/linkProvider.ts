import * as vscode from 'vscode';
import { getTranslationData, findTranslationFile } from '../services/translationService';
import { findKeyPositionInFile } from '../services/fileService';

export function registerLinkProvider(context: vscode.ExtensionContext): vscode.Disposable {
  const provider = vscode.languages.registerDocumentLinkProvider(
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

  return provider;
}