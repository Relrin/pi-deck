import { app, Menu, type MenuItemConstructorOptions, shell } from "electron";

function buildViewSubmenu(): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  if (!app.isPackaged) {
    items.push(
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
    );
  }
  items.push(
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
  );
  return items;
}

function buildMacTemplate(): MenuItemConstructorOptions[] {
  const appName = app.name;
  return [
    {
      label: appName,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    { label: "View", submenu: buildViewSubmenu() },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
    },
    {
      role: "help",
      submenu: [
        {
          label: "pi-deck on GitHub",
          click: async () => {
            await shell.openExternal("https://github.com/relrin/pi-deck");
          },
        },
      ],
    },
  ];
}

function buildDefaultTemplate(): MenuItemConstructorOptions[] {
  return [
    { label: "File", submenu: [{ role: "quit" }] },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    { label: "View", submenu: buildViewSubmenu() },
    {
      role: "help",
      submenu: [
        {
          label: "pi-deck on GitHub",
          click: async () => {
            await shell.openExternal("https://github.com/relrin/pi-deck");
          },
        },
      ],
    },
  ];
}

export function installAppMenu(): void {
  const template = process.platform === "darwin" ? buildMacTemplate() : buildDefaultTemplate();
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
