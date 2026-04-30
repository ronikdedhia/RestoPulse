class Logger {
  private timestamp() {
    return new Date().toISOString();
  }

  info(message: string) {
    console.log(`[${this.timestamp()}] INFO: ${message}`);
  }

  warn(message: string) {
    console.warn(`[${this.timestamp()}] WARN: ${message}`);
  }

  error(message: string) {
    console.error(`[${this.timestamp()}] ERROR: ${message}`);
  }

  debug(message: string) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.timestamp()}] DEBUG: ${message}`);
    }
  }
}

export const logger = new Logger();
