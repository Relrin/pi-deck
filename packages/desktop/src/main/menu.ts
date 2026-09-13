import type { Locale } from "@pi-deck/core";
import { app, Menu, type MenuItemConstructorOptions, shell } from "electron";
import { menuStrings } from "./menu-strings";

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

function buildMacTemplate(locale: Locale): MenuItemConstructorOptions[] {
  const copy = menuStrings(locale);

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
      label: copy.edit,
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
    { label: copy.view, submenu: buildViewSubmenu() },
    {
      label: copy.window,
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
    },
    {
      role: "help",
      submenu: [
        {
          label: copy.github,
          click: async () => {
            await shell.openExternal("https://github.com/relrin/pi-deck");
          },
        },
      ],
    },
  ];
}

function buildDefaultTemplate(locale: Locale): MenuItemConstructorOptions[] {
  const copy = menuStrings(locale);
  return [
    { label: copy.file, submenu: [{ role: "quit" }] },
    {
      label: copy.edit,
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
    { label: copy.view, submenu: buildViewSubmenu() },
    {
      role: "help",
      submenu: [
        {
          label: copy.github,
          click: async () => {
            await shell.openExternal("https://github.com/relrin/pi-deck");
          },
        },
      ],
    },
  ];
}

/**
 * Guard against rebuilding for a locale already installed. The renderer pushes its locale on every
 * bootstrap and on every switch, and `Menu.buildFromTemplate` + `setApplicationMenu` is not free.
 */
let installedLocale: Locale | undefined;

export function installAppMenu(locale: Locale): void {
  if (installedLocale === locale) return;
  installedLocale = locale;
  const template =
    process.platform === "darwin" ? buildMacTemplate(locale) : buildDefaultTemplate(locale);
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
