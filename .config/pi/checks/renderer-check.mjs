import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
const packageRoot = process.env.PI_PACKAGE_ROOT;
assert.ok(packageRoot, "PI_PACKAGE_ROOT is required");
const load = (relative) =>
  import(pathToFileURL(path.join(packageRoot, relative)).href);
const {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  initTheme,
  ToolExecutionComponent,
  AssistantMessageComponent,
  CustomEditor,
  InteractiveMode,
  OAuthSelectorComponent,
  ModelSelectorComponent,
  ThinkingSelectorComponent,
  ThemeSelectorComponent,
  ExtensionSelectorComponent,
  getSettingsListTheme,
} = await load("dist/index.js");
const require = createRequire(path.join(packageRoot, "package.json"));
const {
  visibleWidth,
  TuiAltScreen,
  Container,
  Text,
  setKeybindings,
  CombinedAutocompleteProvider,
  CURSOR_MARKER,
  SettingsList,
  SelectList,
} = await import(require.resolve("@earendil-works/pi-tui"));
const { KeybindingsManager } = await load("dist/core/keybindings.js");
const keybindings = new KeybindingsManager();
setKeybindings(keybindings);
const { getEditorTheme, loadThemeFromPath, setThemeInstance } = await load(
  "dist/modes/interactive/theme/theme.js",
);
const { WorkingStatusIndicator } = await load(
  "dist/modes/interactive/components/status-indicator.js",
);
const originalShowSelector = InteractiveMode.prototype.showSelector;
const originalSelectItem = SelectList.prototype.renderItem;
const originalSettingsRender = SettingsList.prototype.render;
const originalSettingsMouse = SettingsList.prototype.handleMouse;
const originalExtensionRender = ExtensionSelectorComponent.prototype.render;
const originalExtensionMouse = ExtensionSelectorComponent.prototype.handleMouse;
const originalEditorStatus = CustomEditor.prototype.setWorkingStatusIndicator;
let footerFactory;
let workingIndicatorOptions;
const originalEditorRender = CustomEditor.prototype.render;
const originalEditorMouse = CustomEditor.prototype.handleMouse;
const editorHadOwnMouse = Object.hasOwn(CustomEditor.prototype, "handleMouse");
const editorHadOwnRender = Object.hasOwn(CustomEditor.prototype, "render");
const originalMouseDispatch = TuiAltScreen.prototype.applyMouseDispatchResult;
const originalJumpIndicator =
  TuiAltScreen.prototype.compositeScrollToEndIndicator;
const { createInteractiveTui } = await load(
  "dist/modes/interactive/tui-renderer.js",
);
const source =
  process.env.PI_RENDERER_SOURCE ??
  path.resolve(import.meta.dirname, "../extensions/renderer.ts");
initTheme("dark", false);
const sharedTheme = loadThemeFromPath(
  path.resolve(path.dirname(source), "../themes/agent-sandbox.json"),
  "truecolor",
);
setThemeInstance(sharedTheme);
const originalAssistant = AssistantMessageComponent.prototype.updateContent;
const originalShell = ToolExecutionComponent.prototype.getRenderShell;
const agentDir = mkdtempSync("/tmp/pi-renderer-check-");
const loader = new DefaultResourceLoader({
  cwd: "/tmp",
  agentDir,
  noExtensions: true,
  noSkills: true,
  noContextFiles: true,
  noPromptTemplates: true,
  additionalExtensionPaths: [source],
});
await loader.reload();
const { session, extensionsResult } = await createAgentSession({
  cwd: "/tmp",
  resourceLoader: loader,
  agentDir,
  sessionManager: SessionManager.inMemory("/tmp"),
  model: {
    id: "renderer-fixture",
    name: "Renderer fixture",
    provider: "fixture",
    api: "openai-responses",
    baseUrl: "http://unused.invalid",
    reasoning: true,
    input: ["text"],
    contextWindow: 100000,
    maxTokens: 1000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
});
const plain = (lines) =>
  lines
    .join("\n")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "");
const mouse = (y) => ({
  type: "click",
  button: "left",
  x: 2,
  y,
  width: 100,
  modifiers: { shift: false, alt: false, ctrl: false },
});
try {
  assert.deepEqual(extensionsResult.errors, []);
  const extension = extensionsResult.extensions.find(
    (e) => e.resolvedPath === source,
  );
  assert.ok(extension);
  assert.equal(
    extension.tools.size,
    0,
    "Presentation extension must not replace native tools",
  );
  assert.equal(
    extension.toolRenderers.length,
    1,
    "Tool formatting uses the public renderer resolver",
  );
  assert.equal(
    ToolExecutionComponent.prototype.getRenderShell,
    originalShell,
    "Tool shell selection is not patched",
  );
  // Pi measures its editor and can open a startup picker before session_start.
  const startupEditor = new CustomEditor(
    { requestRender() {}, terminal: { rows: 30 } },
    getEditorTheme(),
    keybindings,
  );
  startupEditor.focused = true;
  startupEditor.setText("startup");
  assert.match(
    plain(startupEditor.render(100)),
    /startup/,
    "Initial render works before the extension UI is bound",
  );
  const startupMode = Object.create(InteractiveMode.prototype);
  startupMode.editorContainer = new Container();
  startupMode.editor = startupEditor;
  startupMode.ui = {
    requestRender() {},
    setFocus(component) {
      component.focused = true;
    },
  };
  let startupPicker;
  startupMode.showSelector((done) => {
    startupPicker = new OAuthSelectorComponent(
      "login",
      [{ id: "github-copilot", name: "GitHub Copilot", authType: "oauth" }],
      done,
      done,
    );
    return { component: startupPicker, focus: startupPicker };
  });
  assert.match(
    plain(startupMode.editorContainer.render(100)),
    /GitHub Copilot/,
    "Startup picker works before the extension UI is bound",
  );
  startupPicker.handleInput("\x1b");
  assert.match(
    plain(
      new ExtensionSelectorComponent(
        "Startup",
        ["Ready"],
        () => {},
        () => {},
      ).render(100),
    ),
    /Ready/,
  );
  const ui = {
    ...session.extensionRunner.createContext().ui,
    theme: sharedTheme,
    setFooter: (factory) => {
      footerFactory = factory;
    },
    setWorkingIndicator: (options) => {
      workingIndicatorOptions = options;
    },
  };
  await session.bindExtensions({ uiContext: ui });
  assert.equal(typeof footerFactory, "function");
  assert.deepEqual(workingIndicatorOptions.frames, ["◎", "◉"]);
  session.setThinkingLevel("high");
  const bash = session.agent.state.tools.find((t) => t.name === "bash");
  const result = await bash.execute(
    "runtime-check",
    {
      command:
        'printf "%s\\n" "$PI_MODEL" "$PI_PROVIDER" "$PI_REASONING_LEVEL" "$PI_SESSION_ID"',
    },
    AbortSignal.timeout(10000),
  );
  const values = result.content
    .find((c) => c.type === "text")
    .text.trim()
    .split("\n");
  assert.deepEqual(values.slice(0, 3), [
    session.model.id,
    session.model.provider,
    "high",
  ]);
  assert.ok(values[3], "Native shell keeps its session identifier");
  const args = {
    command: "printf first\\n\nprintf second\\n\nprintf third\\n",
  };
  const output = {
    content: [{ type: "text", text: "first\nsecond\nthird\n" }],
    isError: false,
  };
  const unchanged = structuredClone({ args, output });
  const component = new ToolExecutionComponent(
    "bash",
    "render-check",
    args,
    { showImages: false },
    session.extensionRunner.resolveToolRenderers("bash", () =>
      session.getToolDefinition("bash"),
    ),
    { requestRender() {} },
    "/tmp",
  );
  component.markExecutionStarted();
  component.setArgsComplete();
  component.updateResult(output);
  let lines = component.render(100);
  assert.match(
    plain(lines),
    / Shell printf first.*3 command lines.*3 output lines/,
  );
  assert.doesNotMatch(
    plain(lines),
    /❯|⌄/,
    "Collapsed tool headings have no chevron",
  );
  assert.doesNotMatch(plain(lines), /printf second|│/);
  assert.equal(component.handleMouse(mouse(1))?.handled, true);
  lines = component.render(100);
  assert.match(plain(lines), / Shell/);
  assert.doesNotMatch(
    plain(lines),
    /❯|⌄/,
    "Expanded tool headings have no chevron",
  );
  assert.match(plain(lines), /│ printf second/);
  assert.match(plain(lines), /│ .*third/);
  assert.deepEqual({ args, output }, unchanged);
  component.handleMouse(mouse(1));
  assert.doesNotMatch(plain(component.render(100)), /printf second/);
  component.setExpanded(true);
  const fullOutput = {
    content: [
      {
        type: "text",
        text: Array.from({ length: 25 }, (_, i) => `output-${i + 1}`).join(
          "\n",
        ),
      },
    ],
    isError: false,
  };
  component.updateResult(fullOutput);
  assert.match(plain(component.render(100)), /output-25/);
  assert.equal(fullOutput.content[0].text.split("\n").length, 25);
  for (const width of [1, 2, 8, 40])
    assert.ok(
      component.render(width).every((line) => visibleWidth(line) <= width),
      `Tool width ${width}`,
    );
  component.updateResult({
    content: [
      { type: "text", text: "Permission denied\ntry a different path" },
    ],
    isError: true,
  });
  component.setExpanded(false);
  assert.match(plain(component.render(100)), /failed[\s\S]*Permission denied/);
  const message = {
    role: "assistant",
    provider: "github-copilot",
    model: "gpt-5.4",
    timestamp: 123456,
    content: [
      { type: "thinking", thinking: "Check the native runtime context." },
      { type: "text", text: "The model is available." },
    ],
    stopReason: "stop",
  };
  const originalMessage = structuredClone(message);
  const emit = async (name, event) => {
    for (const handler of extension.handlers.get(name) ?? [])
      await handler(event, session.extensionRunner.createContext());
  };
  const realNow = Date.now;
  try {
    Date.now = () => 10000;
    await emit("message_update", {
      message,
      assistantMessageEvent: { type: "thinking_start", contentIndex: 0 },
    });
    Date.now = () => 12000;
    await emit("message_update", {
      message,
      assistantMessageEvent: { type: "thinking_end", contentIndex: 0 },
    });
    await emit("message_end", { message });
  } finally {
    Date.now = realNow;
  }
  let thought = new AssistantMessageComponent(message);
  assert.match(
    thought.render(100).join("\n"),
    /\x1b\[3m/,
    "Thought heading and body use italic styling",
  );
  assert.match(
    plain(thought.render(100)),
    /⌄ Thought for 2s[\s\S]*│.*Check the native runtime context/,
  );
  assert.equal(thought.handleMouse(mouse(1))?.handled, true);
  assert.match(plain(thought.render(100)), /❯ Thought for 2s/);
  assert.doesNotMatch(
    plain(thought.render(100)),
    /Check the native runtime context/,
  );
  thought.handleMouse(mouse(1));
  assert.match(plain(thought.render(100)), /Check the native runtime context/);
  thought.setHideThinkingBlock(true);
  assert.doesNotMatch(
    plain(thought.render(100)),
    /Check the native runtime context/,
  );
  assert.deepEqual(message, originalMessage);
  // Exercise native fullscreen mouse dispatch, not only component toggles.
  for (const [kind, expandable] of [
    [
      "tool",
      (() => {
        const tool = new ToolExecutionComponent(
          "bash",
          "anchor-check",
          args,
          { showImages: false },
          session.extensionRunner.resolveToolRenderers("bash", () =>
            session.getToolDefinition("bash"),
          ),
          { requestRender() {} },
          "/tmp",
        );
        tool.setArgsComplete();
        tool.updateResult(fullOutput);
        return tool;
      })(),
    ],
    ["thought", new AssistantMessageComponent(message, true)],
  ]) {
    const terminal = new Proxy(
      { columns: 100, rows: 12 },
      {
        get(target, key) {
          return key in target ? target[key] : () => {};
        },
      },
    );
    const tui = createInteractiveTui({
      tuiMode: "fullscreen",
      terminal,
      showHardwareCursor: false,
      logDirectory: "/tmp",
    });
    const document = new Container();
    document.addChild(
      new Text(
        Array.from({ length: 20 }, (_, i) => `earlier-${i}`).join("\n"),
        0,
        0,
      ),
    );
    document.addChild(expandable);
    document.addChild(new Text("trailing-1\ntrailing-2\ntrailing-3", 0, 0));
    tui.addChild(document);
    tui.start();
    try {
      tui.renderNow();
      const headingRow = () =>
        tui
          .getScreenLines()
          .findIndex((line) =>
            plain([line]).includes(
              kind === "tool" ? "Shell" : "Thought for 2s",
            ),
          );
      const beforeRow = headingRow();
      assert.ok(beforeRow >= 0);
      const beforeTop = tui.viewportTop;
      tui.handleMouseEvent({ button: 0, x: 2, y: beforeRow, release: false });
      tui.handleMouseEvent({ button: 0, x: 2, y: beforeRow, release: true });
      tui.renderNow();
      assert.equal(
        headingRow(),
        beforeRow,
        `${kind} heading must remain on the clicked row`,
      );
      assert.equal(
        tui.viewportTop,
        beforeTop,
        `${kind} must open downward instead of following the new bottom`,
      );
      assert.equal(tui.isFollowingOutput, false);
      assert.doesNotMatch(
        plain(tui.getScreenLines()),
        /Jump to latest message/,
      );
      assert.equal(
        tui.scrollToEndIndicatorRect,
        undefined,
        "Hidden popup has no invisible click target",
      );
      assert.equal(
        tui.handleViewportInput("\x1b[1;5F")?.consume,
        true,
        "Ctrl+End retains native navigation",
      );
      tui.renderNow();
      assert.equal(
        tui.isFollowingOutput,
        true,
        "Jump to bottom restores output following",
      );
    } finally {
      tui.stop();
    }
  }
  // Use Pi's native completion provider and list, including command submission.
  const commandEditor = new CustomEditor(
    { requestRender() {}, terminal: { rows: 30 } },
    getEditorTheme(),
    keybindings,
    { paddingX: 1 },
  );
  commandEditor.focused = true;
  commandEditor.setAutocompleteProvider(
    new CombinedAutocompleteProvider(
      [
        { name: "settings", description: "Open settings menu" },
        {
          name: "model",
          description: "Select model",
          getArgumentCompletions: () => [
            { value: "alpha", label: "alpha", description: "Alpha model" },
            { value: "beta", label: "beta", description: "Beta model" },
          ],
        },
        { name: "tree", description: "Navigate session tree" },
        { name: "thinking", description: "Set thinking level" },
        { name: "scoped-models", description: "Choose models" },
        { name: "reload", description: "Reload extensions" },
      ],
      "/tmp",
    ),
  );
  const openCommands = async (text = "/") => {
    commandEditor.setText(text);
    commandEditor.requestAutocomplete({
      force: text === "@",
      explicitTab: false,
    });
    await commandEditor.autocompleteRequestTask;
    assert.equal(commandEditor.isShowingAutocomplete(), true);
  };
  await openCommands();
  let commands = commandEditor.render(100);
  let commandsPlain = commands.map((line) => plain([line]));
  const promptBorder =
    commands.findIndex((line) => line.includes(CURSOR_MARKER)) - 1;
  assert.ok(
    promptBorder > commandsPlain.findIndex((line) => line.includes("settings")),
  );
  assert.equal(commandsPlain[0], "", "Menu has a blank row above it");
  assert.match(
    commandsPlain[1],
    /^› \/settings/,
    "Menu marker aligns with the prompt",
  );
  const selectedCommand = commandsPlain[1];
  const promptText = commandsPlain[promptBorder + 1];
  assert.equal(
    selectedCommand.indexOf("›"),
    promptText.indexOf("›"),
    "Slash menu and prompt markers share a column",
  );
  assert.equal(
    selectedCommand.indexOf("/settings"),
    promptText.indexOf("/"),
    "Slash menu labels and prompt input share a column",
  );
  assert.ok(
    commandsPlain
      .slice(0, promptBorder)
      .some((line) => line.includes("Open settings menu")),
  );
  assert.equal(
    commands.filter((line) => line.includes(CURSOR_MARKER)).length,
    1,
  );
  assert.equal(
    commands.findIndex((line) => line.includes(CURSOR_MARKER)),
    promptBorder + 1,
    "Cursor remains inside the prompt",
  );
  assert.equal(
    commandEditor.handleMouse({ ...mouse(0), type: "wheel", wheelDelta: 1 }),
    undefined,
    "Blank padding is not a command hit",
  );
  commandEditor.handleInput("\x1b[B");
  assert.match(plain(commandEditor.render(100)), /› \/model/);
  commandEditor.handleInput("\t");
  assert.equal(commandEditor.getText(), "/model ");
  assert.equal(commandEditor.isShowingAutocomplete(), false);
  assert.equal(plain([commandEditor.render(100)[0]]).trim(), "");
  await openCommands();
  commandEditor.render(100);
  assert.equal(
    commandEditor.handleMouse({ ...mouse(2), type: "press" })?.handled,
    true,
  );
  assert.equal(commandEditor.handleMouse(mouse(2))?.handled, true);
  assert.equal(
    commandEditor.getText(),
    "/model ",
    "Moved menu clicks apply native completion",
  );
  await openCommands();
  commands = commandEditor.render(100);
  const inputRow = commands.findIndex((line) => line.includes(CURSOR_MARKER));
  commandEditor.handleMouse({ ...mouse(inputRow), x: 1 });
  assert.deepEqual(
    commandEditor.getCursor(),
    { line: 0, col: 0 },
    "Moved prompt clicks still position the cursor",
  );
  await openCommands();
  commandEditor.render(100);
  commandEditor.handleMouse({ ...mouse(1), type: "wheel", wheelDelta: 1 });
  assert.equal(
    commandEditor.autocompleteList.getSelectedItem().value,
    "model",
    "Wheel scrolls the moved menu",
  );
  let submitted;
  commandEditor.onSubmit = (text) => {
    submitted = text;
  };
  commandEditor.handleInput("\r");
  assert.equal(submitted, "/model");
  await openCommands();
  commandEditor.handleInput("\x1b");
  assert.equal(commandEditor.isShowingAutocomplete(), false);
  assert.equal(commandEditor.getText(), "/");
  await openCommands();
  const menuTerminal = new Proxy(
    { columns: 100, rows: 20 },
    {
      get(target, key) {
        return key in target ? target[key] : () => {};
      },
    },
  );
  const menuTui = new TuiAltScreen(menuTerminal);
  menuTui.addChild(commandEditor);
  menuTui.setFocus(commandEditor);
  menuTui.start();
  try {
    menuTui.renderNow();
    const screen = menuTui.getScreenLines().map((line) => plain([line]));
    const selectedRow = screen.findIndex((line) =>
      line.includes("› /settings"),
    );
    const modelRow = screen.findIndex((line) => line.includes("Select model"));
    const promptRow = screen.findIndex((line) => line.trim() === "› /");
    assert.ok(
      selectedRow >= 0 && modelRow > selectedRow && modelRow < promptRow,
    );
    menuTui.handleMouseEvent({ button: 0, x: 4, y: modelRow, release: false });
    menuTui.handleMouseEvent({ button: 0, x: 4, y: modelRow, release: true });
    menuTui.renderNow();
    assert.equal(
      commandEditor.getText(),
      "/model ",
      "Fullscreen press/release selects the command above the prompt",
    );
    assert.equal(commandEditor.isShowingAutocomplete(), false);
  } finally {
    menuTui.stop();
  }
  for (const width of [1, 2, 12, 40, 100]) {
    await openCommands();
    const moved = commandEditor.render(width);
    assert.ok(
      moved.every((line) => visibleWidth(line) <= width),
      `Command menu width ${width}`,
    );
    assert.equal(
      moved.filter((line) => line.includes(CURSOR_MARKER)).length,
      1,
      "Narrow prompt retains hardware cursor",
    );
  }
  commandEditor.paddingX = 4;
  await openCommands();
  const paddedRows = commandEditor.render(100);
  const paddedMenu = plain([paddedRows[1]]);
  const paddedPrompt = plain([
    paddedRows.find((line) => line.includes(CURSOR_MARKER)),
  ]);
  assert.equal(
    paddedMenu.indexOf("›"),
    paddedPrompt.indexOf("›"),
    "Alignment follows configured prompt padding",
  );
  assert.equal(
    paddedMenu.indexOf("/settings"),
    paddedPrompt.indexOf("/"),
    "Text alignment follows configured prompt padding",
  );
  commandEditor.paddingX = 1;
  commandEditor.autocompleteMaxVisible = 3;
  await openCommands();
  assert.equal(
    commandEditor
      .render(100)
      .filter(
        (line) =>
          !line.includes(CURSOR_MARKER) && /^\s*[› ] \//.test(plain([line])),
      ).length,
    3,
    "Menu respects Pi's configured visible-item limit",
  );
  commandEditor.autocompleteMaxVisible = 5;
  await openCommands("/model a");
  const argumentsRows = commandEditor.render(100);
  const argumentItem = argumentsRows.findIndex((line) =>
    plain([line]).includes("Alpha model"),
  );
  const argumentPrompt = argumentsRows.findIndex((line) =>
    line.includes(CURSOR_MARKER),
  );
  assert.ok(
    argumentItem >= 0 && argumentItem < argumentPrompt,
    "Slash-command argument suggestions also appear above the prompt",
  );
  assert.doesNotMatch(
    plain(argumentsRows.slice(0, argumentPrompt)),
    /\/alpha/,
    "Argument labels do not gain a command slash",
  );
  commandEditor.handleInput("\t");
  assert.equal(
    commandEditor.getText(),
    "/model alpha",
    "Native argument completion remains intact",
  );
  // Built-in dialogs use the same list-first layout without replacing handlers.
  const mode = Object.create(InteractiveMode.prototype);
  mode.editorContainer = new Container();
  mode.editor = commandEditor;
  mode.ui = {
    requestRender() {},
    setFocus(component) {
      if (component) component.focused = true;
    },
  };
  const showPicker = (create) => {
    let native;
    mode.showSelector((done) => {
      native = create(done);
      return {
        component: native,
        focus: native,
        dispose: () => native.dispose?.(),
      };
    });
    return { native, layout: mode.editorContainer.children[0] };
  };
  const assertPicker = (layout, label, width = 100) => {
    const rows = layout.render(width);
    const input = rows.findIndex((line) => line.includes(CURSOR_MARKER));
    const item = rows.findIndex((line) => plain([line]).includes(label));
    assert.ok(
      item >= 0 && input > item,
      "Picker options appear above search input",
    );
    assert.ok(
      rows.every((line) => visibleWidth(line) <= width),
      "Picker rows stay within terminal width",
    );
    assert.equal(rows.filter((line) => line.includes(CURSOR_MARKER)).length, 1);
    assert.ok(
      rows[item].startsWith(sharedTheme.getBgAnsi("selectedBg")),
      "Selected row uses shared theme selection background",
    );
    assert.ok(
      rows[input].startsWith(sharedTheme.getBgAnsi("userMessageBg")),
      "Search uses shared theme prompt surface",
    );
    assert.equal(
      plain([rows[item]]).indexOf("›"),
      plain([rows[input]]).indexOf("›"),
      "Native picker selection and search markers share a column",
    );
    assert.doesNotMatch(
      plain(rows),
      /^\s*→ /m,
      "Menu selections use the shared chevron",
    );
    assert.match(
      plain([rows[input]]),
      /^\s*› /,
      "Search prompt uses the same chevron",
    );
    return rows;
  };
  let pickedProvider;
  const auth = showPicker(
    (done) =>
      new OAuthSelectorComponent(
        "login",
        [
          { id: "github-copilot", name: "GitHub Copilot", authType: "oauth" },
          { id: "anthropic", name: "Anthropic", authType: "api_key" },
        ],
        (provider) => {
          pickedProvider = provider;
          done();
        },
        done,
      ),
  );
  assertPicker(auth.layout, "GitHub Copilot");
  auth.native.handleInput("anth");
  assertPicker(auth.layout, "Anthropic");
  auth.native.handleInput("\r");
  assert.equal(pickedProvider, "anthropic");
  assert.equal(
    mode.editorContainer.children[0],
    commandEditor,
    "Selection restores the editor",
  );
  const cancelAuth = showPicker(
    (done) =>
      new OAuthSelectorComponent(
        "login",
        [{ id: "github-copilot", name: "GitHub Copilot", authType: "oauth" }],
        done,
        done,
      ),
  );
  const authRows = assertPicker(cancelAuth.layout, "GitHub Copilot");
  const authInput = authRows.findIndex((line) => line.includes(CURSOR_MARKER));
  assert.equal(
    cancelAuth.layout.handleMouse({
      ...mouse(authInput),
      type: "press",
      height: authRows.length,
    })?.handled,
    true,
    "Moved picker input remains clickable",
  );
  cancelAuth.native.handleInput("\x1b");
  assert.equal(
    mode.editorContainer.children[0],
    commandEditor,
    "Escape restores the editor",
  );
  let pickedModel;
  const fixtureModels = [
    { ...session.model, id: "alpha", name: "Alpha model" },
    { ...session.model, id: "beta", name: "Beta model" },
  ];
  const modelRuntime = {
    getAvailableSnapshot: () => fixtureModels,
    getModel: (provider, id) => fixtureModels.find((model) => model.id === id),
    getError: () => undefined,
    refresh: async () => ({ errors: new Map(), aborted: false }),
  };
  const models = showPicker(
    (done) =>
      new ModelSelectorComponent(
        mode.ui,
        fixtureModels[0],
        modelRuntime,
        [],
        (model) => {
          pickedModel = model;
          done();
        },
        done,
      ),
  );
  assertPicker(models.layout, "alpha");
  models.native.handleInput("beta");
  assertPicker(models.layout, "beta");
  models.native.handleInput("\r");
  assert.equal(pickedModel.id, "beta");
  let level;
  const thinking = showPicker(
    (done) =>
      new ThinkingSelectorComponent(
        "low",
        ["off", "low", "high"],
        (value) => {
          level = value;
          done();
        },
        done,
      ),
  );
  assertPicker(thinking.layout, "low");
  thinking.native.handleInput("\x1b[B");
  assertPicker(thinking.layout, "high");
  thinking.native.handleInput("\r");
  assert.equal(level, "high");
  let setting;
  const settings = new SettingsList(
    [
      {
        id: "theme",
        label: "Theme",
        currentValue: "dark",
        values: ["dark", "light"],
      },
      {
        id: "images",
        label: "Images",
        currentValue: "yes",
        values: ["yes", "no"],
      },
    ],
    5,
    getSettingsListTheme(),
    (id, value) => {
      setting = { id, value };
    },
    () => {},
    { enableSearch: true },
  );
  settings.searchInput.focused = true;
  let settingsRows = settings.render(100);
  assertPicker(settings, "Theme");
  const imageRow = settingsRows.findIndex((line) =>
    plain([line]).includes("Images"),
  );
  settings.handleMouse({
    ...mouse(imageRow),
    type: "press",
    height: settingsRows.length,
  });
  settings.handleMouse({ ...mouse(imageRow), height: settingsRows.length });
  assert.deepEqual(
    setting,
    { id: "images", value: "no" },
    "Moved settings rows keep native click activation",
  );
  const settingsInputRow = settings
    .render(100)
    .findIndex((line) => line.includes(CURSOR_MARKER));
  assert.equal(
    settings.handleMouse({
      ...mouse(settingsInputRow),
      type: "press",
      height: settings.render(100).length,
    })?.handled,
    true,
  );
  for (const width of [1, 2, 12, 40, 100]) {
    const narrow = showPicker(
      (done) =>
        new OAuthSelectorComponent(
          "login",
          [{ id: "github-copilot", name: "GitHub Copilot", authType: "oauth" }],
          done,
          done,
        ),
    );
    assert.ok(
      narrow.layout.render(width).every((line) => visibleWidth(line) <= width),
    );
    assert.equal(
      narrow.layout.render(width).filter((line) => line.includes(CURSOR_MARKER))
        .length,
      1,
    );
    narrow.native.handleInput("\x1b");
  }
  const themePicker = showPicker(
    (done) => new ThemeSelectorComponent("dark", done, done, () => {}),
  );
  assert.match(plain(themePicker.layout.render(100)), /› dark/);
  themePicker.native.getSelectList().handleInput("\x1b");
  const extensionPicker = new ExtensionSelectorComponent(
    "Choose",
    ["First", "Second"],
    () => {},
    () => {},
  );
  assert.ok(
    extensionPicker
      .render(100)
      .find((line) => plain([line]).includes("› First"))
      .startsWith(sharedTheme.getBgAnsi("selectedBg")),
  );

  // Non-command completion retains Pi's original placement and mouse behavior.
  commandEditor.setAutocompleteProvider({
    getSuggestions: async () => ({
      prefix: "@",
      items: [{ value: "file.txt", label: "file.txt" }],
    }),
    applyCompletion: () => ({
      lines: ["file.txt"],
      cursorLine: 0,
      cursorCol: 8,
    }),
  });
  await openCommands("@");
  commands = commandEditor.render(100);
  assert.equal(plain([commands[0]]).trim(), "");
  assert.ok(
    commands.findIndex((line) => line.includes("file.txt")) >
      commands.findIndex((line) => line.includes(CURSOR_MARKER)),
  );
  commandEditor.cancelAutocomplete();
  const editor = new CustomEditor(
    { requestRender() {}, terminal: { rows: 30 } },
    getEditorTheme(),
    { matches: () => false },
    { embedWorkingStatus: true },
  );
  const indicator = new WorkingStatusIndicator(
    { requestRender() {} },
    "Working fixture",
    workingIndicatorOptions,
  );
  try {
    editor.setText("input fixture");
    editor.setWorkingStatusIndicator(indicator);
    const editorLines = editor.render(100).map((line) => plain([line]));
    assert.doesNotMatch(
      editorLines.join("\n"),
      /Working fixture/,
      "Working status belongs in the footer, not the prompt",
    );
    assert.equal(editor.embedWorkingStatus, true);
    assert.equal(editor.getText(), "input fixture");
    const statuses = new Map([["plan-mode", "Plan mode\nread-only"]]);
    let unsubscribed = false;
    const footer = footerFactory({ requestRender() {} }, ui.theme, {
      getGitBranch: () => "fixture-branch",
      getExtensionStatuses: () => statuses,
      onBranchChange: () => () => {
        unsubscribed = true;
      },
    });
    await emit("agent_start", {});
    await emit("message_update", {
      message,
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 1,
        delta: "∑".repeat(512),
      },
    });
    let footerLines = footer.render(120);
    assert.equal(footerLines.length, 1);
    assert.match(
      plain(footerLines),
      /◎ Working fixture.*1.5 KiB.*esc interrupt.*renderer-fixture.*high/,
    );
    assert.match(plain(footerLines), /Plan mode read-only/);
    keybindings.setUserBindings({ "app.interrupt": "ctrl+x" });
    assert.match(plain(footer.render(120)), /ctrl\+x interrupt/);
    assert.doesNotMatch(plain(footer.render(120)), /esc interrupt/);
    keybindings.setUserBindings({ "app.interrupt": [] });
    assert.doesNotMatch(plain(footer.render(120)), / interrupt/);
    keybindings.setUserBindings({});
    for (const width of [0, 1, 2, 12, 30, 60, 120]) {
      const narrow = footer.render(width);
      assert.equal(narrow.length, 1);
      assert.ok(
        narrow.every((line) => visibleWidth(line) <= width),
        `Footer width ${width}`,
      );
    }
    await emit("agent_start", {});
    assert.doesNotMatch(plain(footer.render(120)), /KiB/);
    editor.setWorkingStatusIndicator(undefined);
    editor.render(120);
    footerLines = footer.render(120);
    assert.equal(footerLines.length, 1);
    assert.match(
      plain(footerLines),
      /Plan mode read-only.*.*\/tmp.* fixture-branch.*renderer-fixture.*high/,
    );
    assert.doesNotMatch(plain(footerLines), /Working fixture|interrupt/);
    session.setThinkingLevel("medium");
    assert.match(plain(footer.render(120)), /renderer-fixture.*medium/);
    session.setThinkingLevel("high");
    const originalModel = session.model;
    try {
      session.agent.state.model = { ...originalModel, id: "another-fixture" };
      assert.match(plain(footer.render(120)), /another-fixture/);
      assert.doesNotMatch(plain(footer.render(120)), /renderer-fixture/);
    } finally {
      session.agent.state.model = originalModel;
    }
    statuses.clear();
    assert.doesNotMatch(plain(footer.render(120)), /Plan mode/);
    const getContextUsage = session.getContextUsage;
    try {
      session.getContextUsage = () => ({
        tokens: 42400,
        contextWindow: 100000,
        percent: 42.4,
      });
      assert.match(plain(footer.render(120)), /42% ctx/);
    } finally {
      session.getContextUsage = getContextUsage;
    }
    footer.dispose();
    assert.equal(unsubscribed, true);
  } finally {
    indicator.dispose();
  }
  await session.reload();
  thought = new AssistantMessageComponent(message);
  const restored = plain(thought.render(100));
  assert.equal(
    (restored.match(/Thought for 2s/g) ?? []).length,
    1,
    "Reload restores duration without duplicate headings",
  );
  assert.equal(
    session.agent.state.tools.filter((t) => t.name === "bash").length,
    1,
  );
  await session.extensionRunner.emit({ type: "session_shutdown" });
  assert.equal(
    AssistantMessageComponent.prototype.updateContent,
    originalAssistant,
  );
  assert.equal(ToolExecutionComponent.prototype.getRenderShell, originalShell);
  assert.equal(InteractiveMode.prototype.showSelector, originalShowSelector);
  assert.equal(SelectList.prototype.renderItem, originalSelectItem);
  assert.equal(SettingsList.prototype.render, originalSettingsRender);
  assert.equal(SettingsList.prototype.handleMouse, originalSettingsMouse);
  assert.equal(
    ExtensionSelectorComponent.prototype.render,
    originalExtensionRender,
  );
  assert.equal(
    ExtensionSelectorComponent.prototype.handleMouse,
    originalExtensionMouse,
  );
  assert.equal(CustomEditor.prototype.render, originalEditorRender);
  assert.equal(CustomEditor.prototype.handleMouse, originalEditorMouse);
  assert.equal(
    Object.hasOwn(CustomEditor.prototype, "handleMouse"),
    editorHadOwnMouse,
  );
  assert.equal(
    CustomEditor.prototype.setWorkingStatusIndicator,
    originalEditorStatus,
  );
  assert.equal(footerFactory, undefined);
  assert.equal(workingIndicatorOptions, undefined);
  assert.equal(
    Object.hasOwn(CustomEditor.prototype, "render"),
    editorHadOwnRender,
  );
  assert.equal(
    TuiAltScreen.prototype.applyMouseDispatchResult,
    originalMouseDispatch,
  );
  assert.equal(
    TuiAltScreen.prototype.compositeScrollToEndIndicator,
    originalJumpIndicator,
  );
  const nativeTerminal = new Proxy(
    { columns: 100, rows: 12 },
    {
      get(target, key) {
        return key in target ? target[key] : () => {};
      },
    },
  );
  const nativeTui = createInteractiveTui({
    tuiMode: "fullscreen",
    terminal: nativeTerminal,
    showHardwareCursor: false,
    logDirectory: "/tmp",
  });
  nativeTui.addChild(
    new Text(
      Array.from({ length: 30 }, (_, i) => `line-${i}`).join("\n"),
      0,
      0,
    ),
  );
  nativeTui.start();
  try {
    nativeTui.renderNow();
    nativeTui.scrollBy(-5);
    nativeTui.renderNow();
    assert.match(
      plain(nativeTui.getScreenLines()),
      /Jump to latest message/,
      "Shutdown restores the native popup renderer",
    );
  } finally {
    nativeTui.stop();
  }
  console.log(
    "PASS: native shell context, complete results, command preview, themed autocomplete and native pickers, clicks, keyboard expansion, error visibility, measured thoughts, anchored expansion, one-line working and idle footer, reload, and cleanup",
  );
} finally {
  session.dispose();
  rmSync(agentDir, { recursive: true, force: true });
}
process.exit(0);
