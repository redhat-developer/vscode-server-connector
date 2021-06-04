import { By, Editor, EditorView, WebView } from "vscode-extension-tester";

const BUTTON_FINISH = 'buttonFinish';
const BUTTON_NEXT = 'buttonNext';
const BUTTON_BACK = 'buttonBack';

/**
 * Web View form representation implementation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export abstract class WebViewForm {

    private _editorName: string;
    private _editorView: EditorView;
    private _editor: Editor;

    constructor(name: string) {
        this._editorName = name;
        this._editorView = new EditorView();
    }

    public get editorView(): EditorView {
        return this._editorView;
    }

    public get editor(): Editor {
        if (this._editor) {
            return this._editor;
        } else {
            throw TypeError('Editor was not initialized yet');
        }
    }

    public get editorName(): string {
        return this._editorName;
    }

    public async initializeEditor() {
        this._editor = await this._editorView.openEditor(this.editorName);
    }

    public async enterWebView<T>(callbackFunction: (webView: WebView) => T) {
        if (!this.editor) {
            await this.initializeEditor();
        }  

        const webView = new WebView();
        await webView.switchToFrame();
        let retValue = undefined;
        try {
            retValue = await callbackFunction(webView);
            console.log(`retValue: ${retValue}`);
        } finally {
            await webView.switchBack();
        }
        return retValue;
    }

    public async getElementValueById(id: string): Promise<string> {
        return await this.enterWebView(async (webView) => {
            const element = await webView.findWebElement(By.id(id));
            return await element.getAttribute('value');
        });
    }

    public async setElementValueById(id: string, value: string): Promise<void> {
        return await this.enterWebView(async (webView) => {
            const element = await webView.findWebElement(By.id(id));
            await element.clear().catch(function(ex) {
                ex.message = `Trying to manupulate field with id: '${id}': ${ex.message}`;;
                throw ex;
            });
            await element.sendKeys(value);
        });
    }

    public async finish() {
        await this.collapseAllSections();
        await this.clickButton(BUTTON_FINISH);
    }

    public async next() {
        await this.collapseAllSections();
        await this.clickButton(BUTTON_NEXT);
    }

    public async back() {
        await this.collapseAllSections();
        await this.clickButton(BUTTON_BACK);
    }

    public async collapseAllSections(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const sectionHeaders = await webView.findWebElements(By.className('section__header'));
            await Promise.all(sectionHeaders.map(async (item) => await item.click()));
        });
    }

    /*
    *   Expects button id to find by By.id.
    *   Might happen that button will not be visible in the vscode window. workaround is to colapse all the sections
    */ 
    public async clickButton(buttonId: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await webView.findWebElement(By.id(buttonId));
            await button.click();
        });
    }
} 