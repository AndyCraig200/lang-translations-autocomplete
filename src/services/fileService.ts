import * as vscode from 'vscode';
import * as fs from 'fs';

export async function openFileAtPosition(filePath: string, line: number, character: number): Promise<void> {
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

export async function findKeyPositionInFile(filePath: string, key: string): Promise<{ line: number, character: number } | null> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

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