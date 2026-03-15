export interface Logger {
  info(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
  child(name: string): Logger;
}

function createLogger(segments: string[]): Logger {
  const prefix = segments.join(" > ");

  function format(level: string, msg: string, data?: unknown) {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level}] [${prefix}] ${msg}`;
    return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
  }

  return {
    info(msg, data) {
      console.log(format("INFO", msg, data));
    },
    error(msg, data) {
      console.error(format("ERROR", msg, data));
    },
    child(name) {
      return createLogger([...segments, name]);
    },
  };
}

export function getRootLogger(): Logger {
  return createLogger(["gtm"]);
}
