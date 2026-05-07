export enum OscCategory {
  ANALOG = 0,
  AUDIO_IN = 1,
  KICK = 2,
  SNARE = 3,
  CLAP = 4,
  HIHAT = 5,
  CYMBAL = 6,
  HITS = 7,
  SHOTS = 8,
  VOICE = 9,
  SE = 10,
  FX = 11,
  TOM = 12,
  PERC = 13,
  PHRASE = 14,
  LOOP = 15,
  PCM = 16,
  USER = 17,
}

const CATEGORY_NAMES: Record<OscCategory, string> = {
  [OscCategory.ANALOG]: "Analog",
  [OscCategory.AUDIO_IN]: "Audio In",
  [OscCategory.KICK]: "Kick",
  [OscCategory.SNARE]: "Snare",
  [OscCategory.CLAP]: "Clap",
  [OscCategory.HIHAT]: "HiHat",
  [OscCategory.CYMBAL]: "Cymbal",
  [OscCategory.HITS]: "Hits",
  [OscCategory.SHOTS]: "Shots",
  [OscCategory.VOICE]: "Voice",
  [OscCategory.SE]: "SE",
  [OscCategory.FX]: "FX",
  [OscCategory.TOM]: "Tom",
  [OscCategory.PERC]: "Perc.",
  [OscCategory.PHRASE]: "Phrase",
  [OscCategory.LOOP]: "Loop",
  [OscCategory.PCM]: "PCM",
  [OscCategory.USER]: "User",
};

const NAME_TO_CATEGORY: Record<string, OscCategory> = Object.fromEntries(
  Object.entries(CATEGORY_NAMES).map(([k, v]) => [v, Number(k) as OscCategory])
);

export function categoryDisplayName(cat: OscCategory): string {
  return CATEGORY_NAMES[cat] ?? "User";
}

export function categoryFromDisplayName(name: string): OscCategory {
  return NAME_TO_CATEGORY[name] ?? OscCategory.USER;
}

export enum BeatType {
  SIXTEEN = 0,
  THIRTY_TWO = 1,
  EIGHT_TRI = 2,
  SIXTEEN_TRI = 3,
}

const BEAT_NAMES: Record<BeatType, string> = {
  [BeatType.SIXTEEN]: "16",
  [BeatType.THIRTY_TWO]: "32",
  [BeatType.EIGHT_TRI]: "8 Tri",
  [BeatType.SIXTEEN_TRI]: "16 Tri",
};

export function beatDisplayName(beat: BeatType): string {
  return BEAT_NAMES[beat] ?? "16";
}

export enum LoopType {
  ONE_SHOT = 0,
  LOOP_ALL = 1,
}
