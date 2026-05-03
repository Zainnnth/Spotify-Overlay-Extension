const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("widgetDesktop", {
  hide: () => ipcRenderer.invoke("widget:hide"),
  show: () => ipcRenderer.invoke("widget:show"),
  minimize: () => ipcRenderer.invoke("widget:minimize"),
  setDock: (side) => ipcRenderer.invoke("widget:setDock", side),
  setExpanded: (expanded) => ipcRenderer.invoke("widget:setExpanded", expanded),
  getDisplays: () => ipcRenderer.invoke("widget:getDisplays"),
  setDisplay: (displayId) => ipcRenderer.invoke("widget:setDisplay", displayId),
  getVersion: () => ipcRenderer.invoke("widget:getVersion"),
  spotifyLogin: (clientId) => ipcRenderer.invoke("spotify:login", clientId),
  spotifyRefresh: (payload) => ipcRenderer.invoke("spotify:refresh", payload)
});
