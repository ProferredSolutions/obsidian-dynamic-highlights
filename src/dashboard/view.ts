import { App, ItemView, WorkspaceLeaf, ButtonComponent } from "obsidian";
import DynamicHighlightsPlugin from "src/main";

export const DASHBOARD_VIEW_TYPE = "dynamic-highlights-dashboard";

export class DashboardView extends ItemView {
  plugin: DynamicHighlightsPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: DynamicHighlightsPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Dynamic Highlights Dashboard";
  }

  async onOpen() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("dh-dashboard");

    const header = containerEl.createEl("div", { cls: "dh-dashboard-header" });
    header.createEl("h2", { text: "Dynamic Highlights" });

    const actions = header.createEl("div", { cls: "dh-dashboard-actions" });

    const refreshBtn = new ButtonComponent(actions)
      .setButtonText("Refresh")
      .onClick(() => this.renderList());
    refreshBtn.buttonEl.addClass("dh-btn");

    const content = containerEl.createEl("div", { cls: "dh-dashboard-content" });

    const listContainer = content.createEl("div", { cls: "dh-highlighter-list" });
    listContainer.createEl("h3", { text: "Highlighters" });

    // Build list UI
    this.renderList();
  }

  renderList() {
    const listRoot = this.containerEl.querySelector(".dh-highlighter-list")!;
    listRoot.empty();

    listRoot.createEl("h3", { text: "Highlighters" });

    const order = this.plugin.settings.staticHighlighter.queryOrder;
    const queries = this.plugin.settings.staticHighlighter.queries;

    if (!order.length) {
      listRoot.createEl("div", { text: "No highlighters defined yet." });
      return;
    }

    order.forEach(name => {
      const q = queries[name];
      if (!q) return;
      const row = listRoot.createEl("div", { cls: "dh-row" });
      const meta = row.createEl("div", { cls: "dh-meta" });
      const colorSwatch = meta.createEl("span", { cls: "dh-color" });
      if (q.color) colorSwatch.style.backgroundColor = q.color;
      meta.createEl("span", { cls: "dh-name", text: name });
      meta.createEl("span", { cls: "dh-query", text: q.regex ? `/${q.query}/` : q.query });

      const controls = row.createEl("div", { cls: "dh-controls" });

      const toggle = new ButtonComponent(controls)
        .setButtonText(q.enabled === false ? "Enable" : "Disable")
        .onClick(async () => {
          const isEnabled = q.enabled !== false;
          q.enabled = isEnabled ? false : true;
          await this.plugin.saveSettings();
          this.plugin.updateStaticHighlighter();
          this.plugin.updateCustomCSS();
          this.plugin.updateStyles();
          this.renderList();
        });
      toggle.buttonEl.addClass("dh-btn");

      const edit = new ButtonComponent(controls)
        .setButtonText("Edit")
        .onClick(() => {
          // Open settings tab where items can already be edited
          this.app.setting.open();
        });
      edit.buttonEl.addClass("dh-btn");

      const remove = new ButtonComponent(controls)
        .setButtonText("Remove")
        .onClick(async () => {
          delete this.plugin.settings.staticHighlighter.queries[name];
          this.plugin.settings.staticHighlighter.queryOrder.remove(name);
          await this.plugin.saveSettings();
          this.plugin.updateStaticHighlighter();
          this.plugin.updateCustomCSS();
          this.plugin.updateStyles();
          this.renderList();
        });
      remove.buttonEl.addClass("dh-btn");
      remove.buttonEl.addClass("mod-warning");
    });
  }

  async onClose() {}
}
