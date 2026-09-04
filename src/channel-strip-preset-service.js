import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class ChannelStripPresetService {
  async apply({ folderNames, presetName }) {
    const script = `
on run argv
  set presetName to item 1 of argv
  set folderOne to item 2 of argv
  set folderTwo to item 3 of argv
  tell application "Logic Pro" to activate
  delay 0.8
  tell application "System Events"
    tell process "Logic Pro"
      set frontmost to true
      set settingButton to missing value
      repeat with candidate in (entire contents of front window)
        try
          if role of candidate is "AXPopUpButton" and ((name of candidate contains "Setting") or (description of candidate contains "Setting")) then
            set settingButton to candidate
            exit repeat
          end if
        end try
      end repeat
      if settingButton is missing value then error "Could not find Logic's channel-strip Setting button. Open the Inspector or Mixer and try again."
      click settingButton
      delay 0.5
      tell menu 1 of settingButton
        if folderTwo is not "" then
          tell menu item folderOne
            perform action "AXShowMenu"
            delay 0.35
            tell menu 1
              tell menu item folderTwo
                perform action "AXShowMenu"
                delay 0.35
                click menu item presetName of menu 1
              end tell
            end tell
          end tell
        else
          tell menu item folderOne
            perform action "AXShowMenu"
            delay 0.35
            click menu item presetName of menu 1
          end tell
        end if
      end tell
    end tell
  end tell
end run`;
    await execFileAsync("/usr/bin/osascript", ["-e", script, presetName, folderNames[0] || "", folderNames[1] || ""], { timeout: 20_000 });
    return { ok: true, text: `Loaded “${presetName}” onto the selected Logic channel strip.` };
  }
}
