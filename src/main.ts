import { Plugin, PluginSettingTab, Setting, App } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, EditorState, RangeSet, Compartment } from "@codemirror/state";

type AnimationType = 'none' | 'fade' | 'expand';
type BlinkType = 'none' | 'fade' | 'expand';
type ExpandOrigin = 'bottom' | 'top' | 'center';

interface NaturalFeelSettings {
    enableErrorHighlight: boolean;
    errorAnimation: AnimationType;
    fadeDuration: number;
    expandDuration: number;
    appearanceDelay: number;
    enableSmoothCaret: boolean;
    caretAnimationDuration: number;
    caretBlinkType: BlinkType;
    caretExpandOrigin: ExpandOrigin;
    pauseAnimationWhileMoving: boolean;
    hideCursorWhileTyping: boolean;
    caretColor: string;
}

const DEFAULT_SETTINGS: NaturalFeelSettings = {
    enableErrorHighlight: true,
    errorAnimation: 'none',
    fadeDuration: 200,
    expandDuration: 250,
    appearanceDelay: 500,
    enableSmoothCaret: true,
    caretAnimationDuration: 80,
    caretBlinkType: 'none',
    caretExpandOrigin: 'center',
    pauseAnimationWhileMoving: true,
    hideCursorWhileTyping: true,
    caretColor: '#DADADA'
}

let webFrame: any = null;
try {
    // @ts-ignore
    webFrame = require('electron').webFrame;
} catch (e) {}

function getWordAt(state: EditorState, pos: number): {from: number, to: number} | null {
    const isWordChar = (char: string) => /[\p{L}\p{N}_']/u.test(char);
    let start = pos;
    while (start > 0 && isWordChar(state.doc.sliceString(start - 1, start))) start--;
    let end = pos;
    while (end < state.doc.length && isWordChar(state.doc.sliceString(end, end + 1))) end++;
    if (start === end) return null;
    return {from: start, to: end};
}

function getErrorDecorations(state: EditorState, settings: NaturalFeelSettings, visibleRanges: readonly {from: number, to: number}[]): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    if (!webFrame || !settings.enableErrorHighlight) return builder.finish();

    let className = "natural-feel-error-highlight";
    if (settings.errorAnimation === 'fade') className += " natural-feel-error-highlight-fade";
    else if (settings.errorAnimation === 'expand') className += " natural-feel-error-highlight-expand";

    const errorDecoration = Decoration.mark({ 
        class: className,
        attributes: {
            style: `--natural-feel-fade-duration: ${settings.fadeDuration}ms; --natural-feel-expand-duration: ${settings.expandDuration}ms;`
        }
    });

    for (let { from, to } of visibleRanges) {
        let start = from;
        while (start > 0 && !/\s/.test(state.doc.sliceString(start - 1, start))) start--;
        let end = to;
        while (end < state.doc.length && !/\s/.test(state.doc.sliceString(end, end + 1))) end++;

        const text = state.doc.sliceString(start, end);
        const wordRegex = /[\p{L}\p{N}_']+/gu;
        let match;
        while ((match = wordRegex.exec(text)) !== null) {
            const word = match[0];
            const wordStart = start + match.index;
            const wordEnd = wordStart + word.length;
            if (webFrame.isWordMisspelled(word)) {
                builder.add(wordStart, wordEnd, errorDecoration);
            }
        }
    }
    return builder.finish();
}

const forceUpdateEffect = StateEffect.define<null>();

function smoothCaretPlugin(plugin: NaturalFeelPlugin) {
    return ViewPlugin.fromClass(class {
        carets: HTMLElement[] = [];
        view: EditorView;
        movingTimeout: number | null = null;

        constructor(view: EditorView) {
            this.view = view;
            this.updatePosition();
        }

        update(update: ViewUpdate) {
            if ((update.docChanged || update.selectionSet) && plugin.settings.pauseAnimationWhileMoving) {
                this.view.scrollDOM.classList.add('natural-feel-carets-moving');
                if (this.movingTimeout) window.clearTimeout(this.movingTimeout);
                this.movingTimeout = window.setTimeout(() => {
                    this.view.scrollDOM.classList.remove('natural-feel-carets-moving');
                }, 200);
            }

            if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged || update.geometryChanged) {
                requestAnimationFrame(() => this.updatePosition());
            }
        }

        updatePosition() {
            // Robust focus check for Obsidian
            const hasFocus = this.view.hasFocus || this.view.dom.contains(document.activeElement);
            const selection = this.view.state.selection;
            
            // Remove extra caret elements
            while (this.carets.length > selection.ranges.length) {
                this.carets.pop()?.remove();
            }

            // Add missing caret elements
            while (this.carets.length < selection.ranges.length) {
                const container = document.createElement('div');
                container.className = 'natural-feel-fake-caret-container';
                container.createDiv('natural-feel-fake-caret-inner');
                this.view.scrollDOM.appendChild(container);
                this.carets.push(container);
            }

            if (!hasFocus) {
                this.carets.forEach(c => c.style.display = 'none');
                return;
            }

            const scrollRect = this.view.scrollDOM.getBoundingClientRect();
            const duration = plugin.settings.enableSmoothCaret ? plugin.settings.caretAnimationDuration : 0;

            selection.ranges.forEach((range, i) => {
                const head = range.head;
                const coords = this.view.coordsAtPos(head);
                const caretContainer = this.carets[i];
                if (!caretContainer) return;

                // Ensure the caret is still attached to the DOM
                if (caretContainer.parentElement !== this.view.scrollDOM) {
                    this.view.scrollDOM.appendChild(caretContainer);
                }

                const caretInner = caretContainer.querySelector('.natural-feel-fake-caret-inner') as HTMLElement;

                if (coords && caretInner) {
                    caretContainer.style.display = 'block';
                    caretContainer.style.setProperty('--natural-feel-caret-duration', `${duration}ms`);
                    
                    const left = coords.left - scrollRect.left + this.view.scrollDOM.scrollLeft;
                    const top = coords.top - scrollRect.top + this.view.scrollDOM.scrollTop;
                    const height = coords.bottom - coords.top;

                    caretContainer.style.transform = `translate(${left}px, ${top}px)`;
                    caretInner.style.height = `${height}px`;
                    caretInner.style.backgroundColor = plugin.settings.caretColor;
                    
                    // Reset blink classes
                    caretInner.className = 'natural-feel-fake-caret-inner';
                    void caretInner.offsetWidth; // trigger reflow
                    
                    const blinkType = plugin.settings.caretBlinkType;
                    caretInner.classList.add(`natural-feel-fake-caret-blink-${blinkType}`);
                    if (blinkType === 'expand') {
                        caretInner.classList.add(`origin-${plugin.settings.caretExpandOrigin}`);
                    }
                } else {
                    caretContainer.style.display = 'none';
                }
            });
        }

        destroy() {
            if (this.movingTimeout) window.clearTimeout(this.movingTimeout);
            this.view.scrollDOM.classList.remove('natural-feel-carets-moving');
            this.carets.forEach(c => c.remove());
            this.carets = [];
        }
    });
}

function errorHighlightPlugin(plugin: NaturalFeelPlugin) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        ghosts: DecorationSet = Decoration.none;
        debounceTimer: number | null = null;

        constructor(view: EditorView) {
            this.decorations = getErrorDecorations(view.state, plugin.settings, view.visibleRanges);
        }

        update(update: ViewUpdate) {
            const settingsChanged = update.transactions.some(tr => tr.effects.some(e => e.is(forceUpdateEffect)));
            
            if (update.docChanged || update.viewportChanged || settingsChanged) {
                if (this.debounceTimer) window.clearTimeout(this.debounceTimer);

                const nextDecos = getErrorDecorations(update.state, plugin.settings, update.view.visibleRanges);
                const mappedCurrent = this.decorations.map(update.changes);
                
                // Detect changes and handle immediate vs delayed updates
                if (update.docChanged && !settingsChanged) {
                    const newGhosts: {from: number, to: number}[] = [];
                    let hasNewError = false;
                    let hasResizedError = false;

                    // Check which of the new errors are "new" and which are "resizes"
                    nextDecos.between(0, update.state.doc.length, (nf, nt) => {
                        let overlapsOld = false;
                        mappedCurrent.between(nf - 1, nt + 1, (of, ot) => {
                            if (Math.max(nf, of) < Math.min(nt, ot)) overlapsOld = true;
                        });
                        if (!overlapsOld) hasNewError = true;
                        else hasResizedError = true;
                    });

                    // Check for corrections (ghosts)
                    mappedCurrent.between(0, update.state.doc.length, (of, ot) => {
                        let stillExists = false;
                        nextDecos.between(of - 1, ot + 1, (nf, nt) => {
                            if (Math.max(of, nf) < Math.min(ot, nt)) stillExists = true;
                        });
                        if (!stillExists && of < ot) {
                            const wordRange = getWordAt(update.state, of);
                            newGhosts.push(wordRange || {from: of, to: ot});
                        }
                    });

                    // If we have corrections, apply immediately
                    if (newGhosts.length > 0) {
                        let ghostClassName = "natural-feel-error-highlight";
                        let duration = 0;
                        if (plugin.settings.errorAnimation === 'fade') {
                            ghostClassName += " natural-feel-error-highlight-fade-out";
                            duration = plugin.settings.fadeDuration;
                        } else if (plugin.settings.errorAnimation === 'expand') {
                            ghostClassName += " natural-feel-error-highlight-expand-out";
                            duration = plugin.settings.expandDuration;
                        }

                        const ghostDeco = Decoration.mark({ 
                            class: ghostClassName,
                            attributes: {
                                style: `--natural-feel-fade-duration: ${plugin.settings.fadeDuration}ms; --natural-feel-expand-duration: ${plugin.settings.expandDuration}ms;`
                            }
                        });
                        const ghostBuilder = new RangeSetBuilder<Decoration>();
                        newGhosts.sort((a, b) => a.from - b.from);
                        for (const g of newGhosts) ghostBuilder.add(g.from, g.to, ghostDeco);
                        
                        this.ghosts = RangeSet.join([this.ghosts.map(update.changes), ghostBuilder.finish()]);

                        window.setTimeout(() => {
                            this.ghosts = Decoration.none;
                            update.view.dispatch({});
                        }, duration);
                        
                        this.decorations = nextDecos;
                        return;
                    }

                    // If there are NO new errors, but some errors resized, update immediately
                    if (hasResizedError && !hasNewError) {
                        this.decorations = nextDecos;
                        this.ghosts = this.ghosts.map(update.changes);
                        return;
                    }

                    // If there is a BRAND NEW error, delay the update
                    if (hasNewError) {
                        this.decorations = mappedCurrent;
                        this.ghosts = this.ghosts.map(update.changes);
                        this.debounceTimer = window.setTimeout(() => {
                            update.view.dispatch({ effects: forceUpdateEffect.of(null) });
                        }, plugin.settings.appearanceDelay);
                        return;
                    }
                }

                this.decorations = nextDecos;
                this.ghosts = Decoration.none;
            } else {
                this.decorations = this.decorations.map(update.changes);
                this.ghosts = this.ghosts.map(update.changes);
            }
        }
    }, {
        decorations: v => RangeSet.join([v.decorations, v.ghosts])
    });
}

export default class NaturalFeelPlugin extends Plugin {
    settings: NaturalFeelSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new NaturalFeelSettingTab(this.app, this));

        this.registerDomEvent(window, 'keydown', () => {
            if (this.settings.hideCursorWhileTyping) {
                document.body.classList.add('natural-feel-hide-cursor');
            }
        });

        this.registerDomEvent(window, 'mousemove', () => {
            if (this.settings.hideCursorWhileTyping) {
                document.body.classList.remove('natural-feel-hide-cursor');
            }
        });

        const plugin = this;

        this.registerEditorExtension([
            smoothCaretPlugin(plugin),
            errorHighlightPlugin(plugin)
        ]);
    }

    async onunload() {
        document.body.classList.remove('natural-feel-hide-cursor');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.app.workspace.iterateAllLeaves((leaf) => {
            // @ts-ignore
            const view = leaf.view.editor?.cm as EditorView;
            if (view) {
                view.dispatch({ 
                    effects: [
                        forceUpdateEffect.of(null)
                    ]
                });
            }
        });
    }
}

class NaturalFeelSettingTab extends PluginSettingTab {
    plugin: NaturalFeelPlugin;
    constructor(app: App, plugin: NaturalFeelPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private addResetButton(setting: Setting, key: keyof NaturalFeelSettings) {
        setting.addExtraButton(button => {
            button.setIcon('rotate-ccw')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    (this.plugin.settings as any)[key] = DEFAULT_SETTINGS[key];
                    await this.plugin.saveSettings();
                    this.display();
                });
        });
        const buttonEl = setting.controlEl.querySelector('.extra-setting-button') as HTMLElement;
        if (buttonEl) {
            // Move the button to be before the control element (slider/dropdown)
            setting.controlEl.prepend(buttonEl);
            buttonEl.style.marginRight = '5px';
        }
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'General Settings' });

        new Setting(containerEl)
            .setName('Enable Error Highlight')
            .setDesc('Shows a red transparent box over misspelled words.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableErrorHighlight)
                .onChange(async (value) => {
                    this.plugin.settings.enableErrorHighlight = value;
                    await this.plugin.saveSettings();
                }));

        const appearanceDelaySetting = new Setting(containerEl)
            .setName('Appearance Delay')
            .setDesc('How long to wait after you stop typing before the highlight appears (in milliseconds).')
            .addSlider(slider => slider
                .setLimits(0, 2000, 50)
                .setValue(this.plugin.settings.appearanceDelay)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.appearanceDelay = value;
                    await this.plugin.saveSettings();
                }));
        this.addResetButton(appearanceDelaySetting, 'appearanceDelay');

        const errorAnimationSetting = new Setting(containerEl)
            .setName('Error Highlight Animation')
            .setDesc('Choose how the error highlight appears.')
            .addDropdown(dropdown => dropdown
                .addOption('none', 'None')
                .addOption('fade', 'Fade')
                .addOption('expand', 'Expand')
                .setValue(this.plugin.settings.errorAnimation)
                .onChange(async (value: AnimationType) => {
                    this.plugin.settings.errorAnimation = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));
        this.addResetButton(errorAnimationSetting, 'errorAnimation');

        if (this.plugin.settings.errorAnimation !== 'none') {
            containerEl.createEl('h2', { text: 'Animation Timing' });

            if (this.plugin.settings.errorAnimation === 'fade') {
                const fadeDurationSetting = new Setting(containerEl)
                    .setName('Fade Duration')
                    .setDesc('Speed of the fade animation (in milliseconds).')
                    .addSlider(slider => slider
                        .setLimits(100, 2000, 50)
                        .setValue(this.plugin.settings.fadeDuration)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.fadeDuration = value;
                            await this.plugin.saveSettings();
                        }));
                this.addResetButton(fadeDurationSetting, 'fadeDuration');
            }

            if (this.plugin.settings.errorAnimation === 'expand') {
                const expandDurationSetting = new Setting(containerEl)
                    .setName('Expand Duration')
                    .setDesc('Speed of the expand/contract animation (in milliseconds).')
                    .addSlider(slider => slider
                        .setLimits(100, 2000, 50)
                        .setValue(this.plugin.settings.expandDuration)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.expandDuration = value;
                            await this.plugin.saveSettings();
                        }));
                this.addResetButton(expandDurationSetting, 'expandDuration');
            }
        }

        containerEl.createEl('h2', { text: 'Caret Settings' });

        new Setting(containerEl)
            .setName('Enable Smooth Caret')
            .setDesc('Enables smooth animations for the cursor movement (VS Code style).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSmoothCaret)
                .onChange(async (value) => {
                    this.plugin.settings.enableSmoothCaret = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Hide Cursor While Typing')
            .setDesc('Hides the mouse cursor when you start typing. It reappears when the mouse is moved.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideCursorWhileTyping)
                .onChange(async (value) => {
                    this.plugin.settings.hideCursorWhileTyping = value;
                    if (!value) {
                        document.body.classList.remove('natural-feel-hide-cursor');
                    }
                    await this.plugin.saveSettings();
                }));

        const caretAnimationDurationSetting = new Setting(containerEl)
            .setName('Caret Animation Duration')
            .setDesc('How smooth/fast the caret movement is (in milliseconds).')
            .addSlider(slider => slider
                .setLimits(50, 500, 10)
                .setValue(this.plugin.settings.caretAnimationDuration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.caretAnimationDuration = value;
                    await this.plugin.saveSettings();
                }));
        this.addResetButton(caretAnimationDurationSetting, 'caretAnimationDuration');

        const caretColorSetting = new Setting(containerEl)
            .setName('Caret Color')
            .setDesc('Choose the color of the smooth caret.')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.caretColor)
                .onChange(async (value) => {
                    this.plugin.settings.caretColor = value;
                    await this.plugin.saveSettings();
                }));
        this.addResetButton(caretColorSetting, 'caretColor');

        containerEl.createEl('h2', { text: 'Caret Blink' });

        new Setting(containerEl)
            .setName('Pause Animations While Moving')
            .setDesc('Disables blinking while you are moving the cursor (both horizontally and vertically) for a snappier feel.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.pauseAnimationWhileMoving)
                .onChange(async (value) => {
                    this.plugin.settings.pauseAnimationWhileMoving = value;
                    await this.plugin.saveSettings();
                }));

        const caretBlinkTypeSetting = new Setting(containerEl)
            .setName('Caret Blink Animation')
            .setDesc('Choose how the caret blinks.')
            .addDropdown(dropdown => dropdown
                .addOption('none', 'None (Default)')
                .addOption('fade', 'Fade')
                .addOption('expand', 'Expand')
                .setValue(this.plugin.settings.caretBlinkType)
                .onChange(async (value: BlinkType) => {
                    this.plugin.settings.caretBlinkType = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));
        this.addResetButton(caretBlinkTypeSetting, 'caretBlinkType');

        if (this.plugin.settings.caretBlinkType === 'expand') {
            const caretExpandOriginSetting = new Setting(containerEl)
                .setName('Expand Origin')
                .setDesc('Where the caret expands from.')
                .addDropdown(dropdown => dropdown
                    .addOption('top', 'From Top')
                    .addOption('bottom', 'From Bottom')
                    .addOption('center', 'From Center')
                    .setValue(this.plugin.settings.caretExpandOrigin)
                    .onChange(async (value: ExpandOrigin) => {
                        this.plugin.settings.caretExpandOrigin = value;
                        await this.plugin.saveSettings();
                    }));
            this.addResetButton(caretExpandOriginSetting, 'caretExpandOrigin');
        }

        new Setting(containerEl)
            .setName('Reset Settings')
            .setDesc('Restore all settings to their default values.')
            .addButton(button => button
                .setButtonText('Reset to Defaults')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
                    await this.plugin.saveSettings();
                    this.display();
                }));
    }
}
