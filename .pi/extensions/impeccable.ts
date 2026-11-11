import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
  let touched = false;

  async function runHook(cwd: string, input: object, timeout: number): Promise<string> {
    const launcher = join(cwd, ".agents/skills/impeccable/scripts/impeccable");
    return new Promise((resolve, reject) => {
      const child = spawn(launcher, ["hook"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => child.kill(), timeout);
      child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
      child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(stderr || `检测器退出，状态码：${code}`));
        try {
          resolve(stdout.trim() ? JSON.parse(stdout).hookSpecificOutput?.additionalContext ?? "" : "");
        } catch (error) { reject(error); }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(input));
    });
  }

  pi.on("tool_result", async (event, ctx) => {
    if (event.isError || !["edit", "write"].includes(event.toolName)) return;
    const path = event.input.path;
    if (typeof path !== "string") return;
    touched = true;
    try {
      const reminder = await runHook(ctx.cwd, {
        hook_event_name: "PostToolUse",
        tool_name: event.toolName === "edit" ? "Edit" : "Write",
        tool_input: { file_path: path },
        session_id: ctx.sessionManager.getSessionId(),
        cwd: ctx.cwd,
      }, 5000);
      if (reminder) return { content: [...event.content, { type: "text", text: reminder }] };
    } catch (error) {
      ctx.ui.notify(`Impeccable 检查失败：${String(error)}`, "warning");
    }
  });

  pi.on("agent_before_settle", async (event, ctx) => {
    if (!touched) return;
    touched = false;
    try {
      const reminder = await runHook(ctx.cwd, {
        hook_event_name: "Stop",
        session_id: ctx.sessionManager.getSessionId(),
        cwd: ctx.cwd,
      }, 30000);
      if (reminder) return {
        entries: [...event.entries, { type: "custom_message", customType: "impeccable", content: reminder, display: false }],
        continue: true,
      };
    } catch (error) {
      ctx.ui.notify(`Impeccable 深度检查失败：${String(error)}`, "warning");
    }
  });
}
