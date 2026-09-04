import React, { useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./moodboard.css";

const STORAGE_KEY = "studio-chat-plecat-excalidraw-v1";

function loadScene() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || undefined; }
  catch { return undefined; }
}

function PlecatBoard() {
  const saveTimer = useRef();
  const onChange = useCallback((elements, appState, files) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const safeState = {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
        gridStep: appState.gridStep,
        gridModeEnabled: appState.gridModeEnabled,
        theme: "dark"
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ elements, appState: safeState, files, scrollToContent: true }));
    }, 250);
  }, []);

  return (
    <main className="board-shell">
      <Excalidraw initialData={loadScene()} onChange={onChange} theme="dark" name="Plecat Moodboard" UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: true, export: { saveFileToDisk: true } } }}>
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.Item onSelect={() => window.parent.postMessage({ type: "plecat-board-saved" }, "*")}>Save locally</MainMenu.Item>
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Logo><span className="plecat-board-logo">PLECAT</span></WelcomeScreen.Center.Logo>
            <WelcomeScreen.Center.Heading>Build the visual world of the album.</WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItemLoadScene />
              <WelcomeScreen.Center.MenuItemHelp />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      </Excalidraw>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<PlecatBoard />);
