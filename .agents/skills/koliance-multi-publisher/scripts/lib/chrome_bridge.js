// Chrome AppleScript Bridge for macOS active session automation
// Adheres strictly to AGENTS.md: zero emojis, structured textual logs

const { spawnSync } = require('child_process');

function executeInTab(urlPattern, jsCode) {
  const osaScript = `
tell application "Google Chrome"
  repeat with w in every window
    repeat with t in every tab of w
      if (URL of t) contains ${JSON.stringify(urlPattern)} then
        tell t
          return execute javascript ${JSON.stringify(jsCode)}
        end tell
      end if
    end repeat
  end repeat
  return "ERR_TAB_NOT_FOUND"
end tell
`;

  const res = spawnSync('osascript', [], { input: osaScript, encoding: 'utf8' });
  if (res.error) {
    throw new Error(`[ERROR] AppleScript execution failure: ${res.error.message}`);
  }
  if (res.stderr && res.stderr.trim().length > 0) {
    throw new Error(`[ERROR] AppleScript stderr: ${res.stderr.trim()}`);
  }
  return res.stdout.trim();
}

function navigateTab(urlPattern, targetUrl) {
  const osaScript = `
tell application "Google Chrome"
  repeat with w in every window
    repeat with t in every tab of w
      if (URL of t) contains ${JSON.stringify(urlPattern)} then
        tell t
          set URL to ${JSON.stringify(targetUrl)}
          return "OK"
        end tell
      end if
    end repeat
  end repeat
  return "ERR_TAB_NOT_FOUND"
end tell
`;

  const res = spawnSync('osascript', [], { input: osaScript, encoding: 'utf8' });
  if (res.error) {
    throw new Error(`[ERROR] Navigation failure: ${res.error.message}`);
  }
  return res.stdout.trim();
}

function listTabs() {
  const osaScript = `
tell application "Google Chrome"
  set res to ""
  repeat with w in every window
    repeat with t in every tab of w
      set res to res & (title of t) & " ::: " & (URL of t) & "\\n"
    end repeat
  end repeat
  return res
end tell
`;

  const res = spawnSync('osascript', [], { input: osaScript, encoding: 'utf8' });
  if (res.error) {
    throw new Error(`[ERROR] List tabs failure: ${res.error.message}`);
  }
  return res.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const parts = line.split(' ::: ');
      return { title: parts[0] || '', url: parts[1] || '' };
    });
}

module.exports = {
  executeInTab,
  navigateTab,
  listTabs,
};
