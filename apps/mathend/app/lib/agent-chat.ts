type ChatResponseParams = {
  providerLabel: string;
  message: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  sessionId?: string;
};

const normalizeMessage = (input: string): string =>
  input.replace(/\s+/g, " ").trim();

const containsAny = (source: string, terms: string[]): boolean => {
  return terms.some((term) => source.includes(term));
};

export const createMockAgentResponse = ({
  providerLabel,
  message,
  history,
  sessionId,
}: ChatResponseParams): string => {
  const prompt = normalizeMessage(message);
  if (!prompt) {
    return "Tulis pertanyaanmu dulu, nanti aku bantu langkah demi langkah.";
  }

  const turnCount = (history?.length ?? 0) + 1;
  const sessionLabel = sessionId ? `session ${sessionId}` : "current session";

  const lower = prompt.toLowerCase();
  const isMathQuestion = containsAny(lower, [
    "turunan",
    "derivative",
    "integral",
    "limit",
    "matrix",
    "aljabar",
    "calculus",
    "rumus",
    "equation",
  ]);

  if (isMathQuestion) {
    return [
      `${providerLabel} active. Aku bantu pecahkan soalnya secara terstruktur.`,
      `Konteks: ${sessionLabel}, turn ${turnCount}.`,
      "1) Identifikasi apa yang dicari dan variabel yang diketahui.",
      "2) Pilih rumus inti lalu sederhanakan bentuk persamaannya.",
      "3) Kerjakan substitusi bertahap dan cek satuan/arah tanda.",
      "4) Verifikasi hasil akhir dengan uji cepat (substitusi balik atau limit behavior).",
      "Kalau mau, kirim detail soalnya (angka lengkap), nanti aku hitung sampai final.",
    ].join("\n");
  }

  return [
    `${providerLabel} connected.`,
    `Konteks: ${sessionLabel}, turn ${turnCount}.`,
    "Aku siap bantu brainstorming, nulis penjelasan, atau breakdown task jadi action items.",
    `Konteksmu: "${prompt.slice(0, 180)}${prompt.length > 180 ? "..." : ""}"`,
    "Lanjutkan dengan tujuan akhir yang kamu mau (misalnya output, format, atau deadline).",
  ].join("\n");
};
