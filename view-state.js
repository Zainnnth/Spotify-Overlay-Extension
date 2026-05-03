export function createViewStateController(deps) {
  const {
    loginView,
    appView,
    popupHeader,
    settingsView,
    mainTabBtn,
    settingsBtn,
    joinBtn,
    queueBtn,
    peekBtn,
    hideBtn,
    queuePopup,
    jamWidget,
    tokenInput,
    edgePeekModeRef,
    isDesktopWidget,
    widgetDesktop,
    getCurrentMainView,
    setCurrentMainView
  } = deps;

  function signedIn() {
    return Boolean(localStorage.getItem("spotify_access_token") || tokenInput.value.trim());
  }

  function setAuthView() {
    const isSignedIn = signedIn();
    loginView.hidden = isSignedIn;
    appView.hidden = !isSignedIn;
    if (popupHeader) popupHeader.hidden = !isSignedIn;
    if (!isSignedIn) settingsView.hidden = true;
    joinBtn.hidden = !isSignedIn;
    queueBtn.hidden = !isSignedIn;
    peekBtn.hidden = !isSignedIn;
    settingsBtn.hidden = !isSignedIn;
    if (hideBtn) hideBtn.hidden = !isSignedIn;
    if (!isSignedIn) {
      settingsView.hidden = true;
      mainTabBtn.classList.add("active");
      settingsBtn.classList.remove("active");
      setCurrentMainView("main");
    }
  }

  function setTab(view) {
    const showSettings = view === "settings";
    if (!signedIn()) return;
    setCurrentMainView(showSettings ? "settings" : "main");
    appView.hidden = showSettings;
    settingsView.hidden = !showSettings;
    mainTabBtn.classList.toggle("active", !showSettings);
    settingsBtn.classList.toggle("active", showSettings);
  }

  function setPopupState(open) {
    const resolvedOpen = Boolean(open);
    const wasOpen = queuePopup.classList.contains("open");
    queuePopup.classList.toggle("open", resolvedOpen);
    queuePopup.setAttribute("aria-hidden", String(!resolvedOpen));
    queueBtn.setAttribute("aria-expanded", String(resolvedOpen));
    if (edgePeekModeRef()) {
      if (!resolvedOpen) jamWidget.classList.add("peek-hidden");
      else jamWidget.classList.remove("peek-hidden");
    }
    if (resolvedOpen) {
      if (!signedIn()) {
        loginView.hidden = false;
        appView.hidden = true;
        settingsView.hidden = true;
      } else {
        setTab(getCurrentMainView() === "settings" ? "settings" : "main");
      }
    }
    if (isDesktopWidget && widgetDesktop?.setExpanded && wasOpen !== resolvedOpen) {
      widgetDesktop.setExpanded(resolvedOpen);
    }
  }

  return { setAuthView, setTab, setPopupState };
}
