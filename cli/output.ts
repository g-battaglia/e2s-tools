export type OutputFormat = "json" | "table" | "text";

export function render(data: unknown, fmt: OutputFormat = "json", title = ""): string {
  if (fmt === "json") {
    return JSON.stringify(data, null, 2);
  }
  if (fmt === "table") {
    return renderTable(data, title);
  }
  return renderText(data);
}

function renderTable(data: unknown, title: string): string {
  if (typeof data !== "object" || data === null) return String(data);
  const d = data as Record<string, unknown>;

  const lines: string[] = [];
  if (title) lines.push(title);

  if ("samples" in d && Array.isArray(d.samples)) {
    lines.push(`${pad("OSC#", 6)} ${pad("Name", 20)} ${pad("Category", 12)} ${pad("Freq", 8)} Stereo`);
    lines.push("-".repeat(55));
    for (const s of d.samples) {
      const sample = s as Record<string, unknown>;
      lines.push(
        `${pad(String(sample.osc_number ?? ""), 6)} ${pad(String(sample.name ?? ""), 20)} ${pad(String(sample.category ?? ""), 12)} ${pad(String(sample.sampling_freq ?? ""), 8)} ${sample.is_stereo ? "Y" : "N"}`,
      );
    }
  } else if ("parts" in d && Array.isArray(d.parts)) {
    lines.push(...renderPatternTable(d, title));
  } else {
    lines.push(pad("Field", 25), "Value");
    lines.push("-".repeat(50));
    for (const [key, val] of Object.entries(d)) {
      if (key === "parts") continue;
      lines.push(`${pad(key, 25)} ${String(val)}`);
    }
  }

  return lines.join("\n");
}

function renderPatternTable(d: Record<string, unknown>, _title: string): string[] {
  const lines: string[] = [];
  const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const keyVal = d.key as number;
  for (const [key, val] of Object.entries(d)) {
    if (key === "parts") continue;
    const display = key === "key" ? (KEY_NAMES[keyVal] ?? String(keyVal)) : String(val);
    lines.push(`${pad(key, 25)} ${display}`);
  }
  lines.push("");

  const parts = d.parts as unknown as Record<string, unknown>[];
  if (parts && parts.length > 0) {
    const cols = ["Pt", "OSC", "LastSt", "Voice", "Prio", "Mot", "Lvl", "Pan", "Pitch", "Gld"];
    lines.push(cols.map((c) => pad(c, 6)).join(" "));
    lines.push("-".repeat(cols.length * 7));
    for (const p of parts) {
      lines.push(
        cols
          .map((c) => pad(String((p as Record<string, unknown>)[partFieldMap[c] ?? c] ?? ""), 6))
          .join(" "),
      );
    }
  }
  return lines;
}

const partFieldMap: Record<string, string> = {
  Pt: "index",
  OSC: "oscillator",
  LastSt: "last_step",
  Voice: "voice_assign",
  Prio: "part_priority",
  Mot: "motion_seq",
  Lvl: "level",
  Pan: "pan",
  Pitch: "pitch",
  Gld: "glide",
};

function renderText(data: unknown): string {
  if (typeof data !== "object" || data === null) return String(data);
  const lines: string[] = [];
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) {
        lines.push(`  ${JSON.stringify(item)}`);
      }
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  return lines.join("\n");
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}
