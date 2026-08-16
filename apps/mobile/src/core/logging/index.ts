import { AppError } from '../errors';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogTransport {
  log: (level: LogLevel, message: string, context?: Record<string, unknown>) => void;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  namespace: string;
}

const consoleTransport: LogTransport = {
  log: (level, message, context) => {
    const prefix = `[CatoLedger]`;
    const payload = context ? ` ${JSON.stringify(context)}` : '';
    if (level === 'debug') console.debug(`${prefix} ${message}${payload}`);
    else if (level === 'info') console.info(`${prefix} ${message}${payload}`);
    else if (level === 'warn') console.warn(`${prefix} ${message}${payload}`);
    else console.error(`${prefix} ${message}${payload}`);
  },
};

class Logger {
  private level: LogLevel = 'info';
  private transports: LogTransport[] = [consoleTransport];

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  child(namespace: string): Logger {
    return new ChildLogger(this, namespace);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.level]) return;
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      namespace: 'root',
    };
    for (const transport of this.transports) {
      try {
        transport.log(entry.level, entry.message, entry.context);
      } catch {
        // never let logging break the app
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write('debug', message, context);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }
  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.write('error', message, {
      ...context,
      ...(error instanceof AppError
        ? { error_code: error.code, error_message: error.message }
        : error instanceof Error
          ? { error_name: error.name, error_message: error.message }
          : { raw_error: String(error) }),
    });
  }
}

class ChildLogger extends Logger {
  private parent: Logger;
  private namespace: string;

  constructor(parent: Logger, namespace: string) {
    super();
    this.parent = parent;
    this.namespace = namespace;
  }

  override setLevel(_level: LogLevel): void {
    // inherited from parent
  }

  override addTransport(_transport: LogTransport): void {
    // inherited from parent
  }

  override debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(`[${this.namespace}] ${message}`, context);
  }
  override info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(`[${this.namespace}] ${message}`, context);
  }
  override warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(`[${this.namespace}] ${message}`, context);
  }
  override error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.parent.error(`[${this.namespace}] ${message}`, error, context);
  }
}

export const logger = new Logger();

export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}
