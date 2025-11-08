import { Extension, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { debounce, MarkdownView, Plugin, WorkspaceLeaf } from "obsidian";
import { highlightSelectionMatches, reconfigureSelectionHighlighter } from "./highlighters/selection";
import { buildStyles, staticHighlighterExtension } from "./highlighters/static";
import addIcons from "./icons/customIcons";
import { DEFAULT_SETTINGS, DynamicHighlightsSettings, HighlighterOptions } from "./settings/settings";
import { SettingTab } from "./settings/ui";
import { DashboardView, DASHBOARD_VIEW_TYPE } from "./dashboard/view";

interface CustomCSS {
  css: string;
  enabled: boolean;
}

export default class DynamicHighlightsPlugin extends Plugin {
  settings: DynamicHighlightsSettings;
  extensions: Extension[];
  styles: Extension;
  staticHighlighter: Extension;
  selectionHighlighter: Extension;
  customCSS: Record<string, CustomCSS>;
  styleEl: HTMLElement;
  settingsTab: SettingTab;

  async onload() {
    await this.loadSettings();
    this.settingsTab = new SettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    this.registerView(DASHBOARD_VIEW_TYPE, leaf => new DashboardView(leaf, this));
    this.addCommand({
      id: "open-dynamic-highlights-dashboard",
      name: "Open Dynamic Highlights Dashboard",
      callback: async () => {
        await this.activateDashboardView();
      },
    });
    addIcons();
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions = [];
    this.updateSelectionHighlighter();
    this.updateStaticHighlighter();
    this.updateStyles();
    this.registerEditorExtension(this.extensions);
    this.initCSS();
  }

  async activateDashboardView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    }
    leaf && workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (this.settings.selectionHighlighter.highlightDelay < 200) {
      this.settings.selectionHighlighter.highlightDelay = 200;
      this.saveSettings;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  initCSS() {
    let styleEl = (this.styleEl = document.createElement("style"));
    styleEl.setAttribute("type", "text/css");
    document.head.appendChild(styleEl);
    this.register(() => styleEl.detach());
    this.updateCustomCSS();
  }

  updateCustomCSS() {
    this.styleEl.textContent = Object.values(this.settings.staticHighlighter.queries)
      .map(q => q && q.css)
      .join("\n");
    this.app.workspace.trigger("css-change");
  }

  updateStyles() {
    this.extensions.remove(this.styles);
    this.styles = buildStyles(this);
    this.extensions.push(this.styles);
    this.app.workspace.updateOptions();
  }

  updateStaticHighlighter() {
    this.extensions.remove(this.staticHighlighter);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions.push(this.staticHighlighter);
    this.app.workspace.updateOptions();
  }

  updateSelectionHighlighter() {
    this.extensions.remove(this.selectionHighlighter);
    this.selectionHighlighter = highlightSelectionMatches(this.settings.selectionHighlighter)
    this.extensions.push(this.selectionHighlighter);
    this.app.workspace.updateOptions();
  }

  iterateCM6(callback: (editor: EditorView) => unknown) {
    this.app.workspace.iterateAllLeaves(leaf => {
      leaf?.view instanceof MarkdownView &&
        (leaf.view.editor as any)?.cm instanceof EditorView &&
        callback((leaf.view.editor as any).cm);
    });
  }

  updateConfig = debounce(
    (type: string, config: HighlighterOptions) => {
      let reconfigure: (config: HighlighterOptions) => StateEffect<unknown>;
      if (type === "selection") {
        reconfigure = reconfigureSelectionHighlighter;
      } else {
        return;
      }
      this.iterateCM6(view => {
        view.dispatch({
          effects: reconfigure(config),
        });
      });
    },
    1000,
    true
  );
}
