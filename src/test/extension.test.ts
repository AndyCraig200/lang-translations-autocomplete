import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Extension Integration Test Suite', () => {
  let tempDir: string;
  let workspaceFile: string;

  suiteSetup(async function() {
    this.timeout(30000); // Increase timeout significantly for setup
    
    try {
      // Create a temporary directory for testing
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-test-'));
      console.log(`Created temp dir: ${tempDir}`);
      
      // Create a locales directory with en.json
      const localesDir = path.join(tempDir, 'locales');
      fs.mkdirSync(localesDir, { recursive: true });
      console.log(`Created locales dir: ${localesDir}`);
      
      // Create sample en.json
      const translationData = {
        "common.ok" : 'OK',
        "common.cancel" : 'Cancel',
        "errors.notFound" : 'Not Found',

      };
      const enJsonPath = path.join(localesDir, 'en.json');
      fs.writeFileSync(enJsonPath, JSON.stringify(translationData, null, 2));
      console.log(`Created en.json at: ${enJsonPath}`);
      
      // Verify the file was written correctly
      const fileContent = fs.readFileSync(enJsonPath, 'utf8');
      console.log(`File content read: ${fileContent.length} bytes`);
      const parsedContent = JSON.parse(fileContent);
      assert.deepStrictEqual(parsedContent, translationData, 'Translation data was not written correctly');
      
      // Create a test JavaScript file
      const testFile = path.join(tempDir, 'test.js');
      const testContent = `
// Test file
function test() {
  const message = Lang.t('common.ok');
  const notFound = Lang.t('errors.notFound');
}`;
      fs.writeFileSync(testFile, testContent);
      console.log(`Created test file at: ${testFile} with content: ${testContent.trim()}`);
      
      // Verify that it exists
      if (!fs.existsSync(testFile)) {
        throw new Error(`Test file was not created at: ${testFile}`);
      }
      
      // Create a workspace file instead of using openFolder command
      workspaceFile = path.join(tempDir, 'test.code-workspace');
      const workspaceContent = {
        folders: [{ path: tempDir }],
        settings: {}
      };
      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceContent, null, 2));
      console.log(`Created workspace file at: ${workspaceFile}`);

      // Instead of opening a folder, which can restart the extension host,
      // we'll add the folder to the workspace
      try {
        await vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.file(tempDir) });
        console.log(`Added ${tempDir} to workspace`);
      } catch (err) {
        console.error('Error updating workspace folders:', err);
        throw new Error(`Failed to update workspace folders: ${err}`);
      }
      
      // Wait for extension to activate
      console.log('Waiting for extension activation...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Setup complete');
    } catch (err) {
      console.error('SETUP FAILED:', err);
      throw err; // Re-throw to fail the test
    }
  });
  
  suiteTeardown(async () => {
    try {
      // Clean up the temp directory
      console.log(`Cleaning up temp directory: ${tempDir}`);
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('Temp directory removed');
      } else {
        console.log('Temp directory did not exist during cleanup');
      }
    } catch (err) {
      console.error('Error during teardown:', err);
    }
  });

  test('Extension should activate when opening supported files', async function() {
    this.timeout(10000);
    try {
      // Open the test.js file to trigger activation
      const testFile = vscode.Uri.file(path.join(tempDir, 'test.js'));
      console.log(`Opening test file to trigger activation: ${testFile.fsPath}`);
      
      if (!fs.existsSync(testFile.fsPath)) {
        throw new Error(`Test file does not exist at ${testFile.fsPath}`);
      }
      
      const document = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(document);
      
      // Give some time for the extension to activate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for our extension
      const extensionId = 'AndyCraig.lang-translation-autocomplete';
      console.log(`Looking for extension: ${extensionId}`);
      
      // List all extensions to help with debugging
      const allExtensions = vscode.extensions.all.map(ext => ext.id);
      console.log(`Found ${allExtensions.length} extensions installed: ${allExtensions.join(', ')}`);
      
      const extension = vscode.extensions.getExtension(extensionId);
      
      // Check if extension is available
      assert.ok(extension, `Extension not found: ${extensionId}. Make sure the extension ID is correct and it is installed`);
      
      // Additional debugging for extension state
      console.log(`Extension found: ${extension.id}`);
      console.log(`Extension activation state: ${extension.isActive ? 'active' : 'inactive'}`);
      
      // Check if extension is active
      assert.strictEqual(
        extension.isActive, 
        true, 
        `Extension is not active. Current state: ${extension.isActive}. Check activation events in package.json.`
      );
      
      console.log('Extension activation test passed');
    } catch (err) {
      console.error('Extension activation test failed:', err);
      throw err;
    }
  });
  
  test('Document links should be created for existing translation keys', async function() {
    this.timeout(15000);
    try {
      console.log('Starting document links test');
      
      // Open the test.js file
      const testFile = vscode.Uri.file(path.join(tempDir, 'test.js'));
      
      // Make sure the file exists
      if (!fs.existsSync(testFile.fsPath)) {
        throw new Error(`Test file does not exist at ${testFile.fsPath}`);
      }
      
      console.log(`Opening test file for document links: ${testFile.fsPath}`);
      const document = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(document);
      
      // Log the file content to verify it's what we expect
      console.log(`File content: "${document.getText()}"`);
      
      // Wait for links to be created
      console.log('Waiting for document links to be processed...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        // Get document links
        console.log('Executing link provider command');
        const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
          'vscode.executeLinkProvider', document.uri
        );
        
        // Log links information
        console.log(`Found ${links?.length || 0} document links`);
        if (links && links.length > 0) {
          links.forEach((link, i) => {
            console.log(`Link ${i}: Range ${link.range.start.line}:${link.range.start.character}-${link.range.end.line}:${link.range.end.character}, Text: "${document.getText(link.range)}"`);
          });
        } else {
          console.log('WARNING: No document links found. This might indicate an issue with the link provider.');
        }
        
        // There should be at least 2 links for our 2 translation keys
        assert.ok(
          links && links.length >= 2, 
          `Expected at least 2 document links, but found ${links?.length || 0}. This indicates the provider isn't working correctly.`
        );
        
        // Check that we have links for both our translation keys
        const linkTexts = links ? links.map(link => document.getText(link.range)) : [];
        console.log(`Found link texts: ${JSON.stringify(linkTexts)}`);
        
        assert.ok(
          linkTexts.includes('common.ok') || linkTexts.some(t => t.includes('common.ok')), 
          `Expected to find link for "common.ok", but only found these links: ${JSON.stringify(linkTexts)}`
        );
        assert.ok(
          linkTexts.includes('errors.notFound') || linkTexts.some(t => t.includes('errors.notFound')), 
          `Expected to find link for "errors.notFound", but only found these links: ${JSON.stringify(linkTexts)}`
        );
        
        console.log('Document links test passed');
      } catch (err) {
        console.error('Error executing link provider:', err);
        throw new Error(`Failed to execute link provider: ${err}`);
      }
    } catch (err) {
      console.error('Document links test failed:', err);
      throw err;
    }
  });
  
  test('Completion proposals should appear for Lang.t calls', async function() {
    this.timeout(20000);
    
    try {
      // Create a new test file with exact character count for cursor positioning
      const newTestFile = path.join(tempDir, 'completion-test.js');
      const fileContent = `function test() { const msg = Lang.t('`;
      fs.writeFileSync(newTestFile, fileContent);
      console.log(`Created completion test file at: ${newTestFile} with content: "${fileContent}"`);
      
      if (!fs.existsSync(newTestFile)) {
        throw new Error(`Failed to create completion test file at ${newTestFile}`);
      }
      
      // Open the file
      console.log(`Opening completion test file: ${newTestFile}`);
      const document = await vscode.workspace.openTextDocument(newTestFile);
      const editor = await vscode.window.showTextDocument(document);
      
      // Verify file is open
      console.log(`Document opened: ${document.uri.toString()}`);
      console.log(`Document text: "${document.getText()}"`);
      
      // Position cursor after the opening quote - validate position
      const cursorPosition = fileContent.indexOf("'") + 1;
      console.log(`Cursor position should be at character ${cursorPosition} based on content`);
      const position = new vscode.Position(0, cursorPosition);
      editor.selection = new vscode.Selection(position, position);
      console.log(`Set cursor position to: line ${position.line}, character ${position.character}`);
      
      // Wait for VS Code to register the document
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        // Get completion items directly without triggering UI
        console.log(`Executing completion item provider at position ${position.line}:${position.character}`);
        const completionList = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          position
        );
        
        // Log completion items
        console.log(`Found ${completionList?.items.length || 0} completion items`);
        if (completionList?.items && completionList.items.length > 0) {
          const itemsToShow = Math.min(completionList.items.length, 20);
          for (let i = 0; i < itemsToShow; i++) {
            const item = completionList.items[i];
            const label = typeof item.label === 'string' ? item.label : item.label.label;
            console.log(`Completion item ${i}: Label "${label}", Kind: ${item.kind}`);
          }
          if (completionList.items.length > itemsToShow) {
            console.log(`... and ${completionList.items.length - itemsToShow} more items`);
          }
        } else {
          console.log('WARNING: No completion items found. This indicates the provider is not working.');
        }
        
        // Check if we have our translation keys in the completion items
        assert.ok(
          completionList && completionList.items.length > 0, 
          'No completion items were provided. Check if your CompletionItemProvider is correctly registered and working.'
        );
        
        const itemLabels = completionList.items.map(item => 
          typeof item.label === 'string' ? item.label : item.label.label
        );
        
        // Check if any of the labels contains our translation keys
        const hasCommonOk = itemLabels.some(label => label === 'common.ok' || label.includes('common.ok'));
        const hasCommonCancel = itemLabels.some(label => label === 'common.cancel' || label.includes('common.cancel'));
        const hasErrorsNotFound = itemLabels.some(label => label === 'errors.notFound' || label.includes('errors.notFound'));
        
        console.log(`Translation key checks: common.ok: ${hasCommonOk}, common.cancel: ${hasCommonCancel}, errors.notFound: ${hasErrorsNotFound}`);
        
        assert.ok(
          hasCommonOk, 
          `Expected "common.ok" in completion items, but it was not found. Found items: ${JSON.stringify(itemLabels.slice(0, 20))}`
        );
        assert.ok(
          hasCommonCancel, 
          `Expected "common.cancel" in completion items, but it was not found. Found items: ${JSON.stringify(itemLabels.slice(0, 20))}`
        );
        assert.ok(
          hasErrorsNotFound, 
          `Expected "errors.notFound" in completion items, but it was not found. Found items: ${JSON.stringify(itemLabels.slice(0, 20))}`
        );
        
        console.log('Completion test passed');
      } catch (err) {
        console.error('Error executing completion provider:', err);
        throw new Error(`Failed to execute completion provider: ${err}`);
      }
    } catch (err) {
      console.error('Completion test failed:', err);
      throw err;
    }
  });
});