const fs = require('fs');
const path = require('path');
const os = require('os');

// Create logs directory if it doesn't exist, with fallbacks for read-only FS
let logsDir = process.env.LOG_DIR || path.join(__dirname, '../logs');
let fileLoggingEnabled = true;

const ensureLogsDir = () => {
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (e) {
    // Attempt to fallback to a writable tmp directory
    try {
      const tmpLogs = path.join(os.tmpdir(), 'logs');
      if (!fs.existsSync(tmpLogs)) {
        fs.mkdirSync(tmpLogs, { recursive: true });
      }
      logsDir = tmpLogs;
    } catch (e2) {
      // Disable file logging if even tmp dir is not writable
      fileLoggingEnabled = false;
    }
  }
};

ensureLogsDir();

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level (can be set via environment variable)
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Format timestamp
const formatTimestamp = () => {
  return new Date().toISOString();
};

// Format log message
const formatMessage = (level, message, data = null) => {
  const timestamp = formatTimestamp();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  return JSON.stringify(logEntry);
};

// Write to file (gracefully degrade on read-only filesystems)
const writeToFile = (filename, content) => {
  if (!fileLoggingEnabled) return;
  const filePath = path.join(logsDir, filename);
  const logEntry = content + '\n';
  try {
    fs.appendFileSync(filePath, logEntry);
  } catch (e) {
    // Disable file logging on common immutable FS errors
    if (['EROFS', 'EACCES', 'ENOSPC'].includes(e.code)) {
      fileLoggingEnabled = false;
      // Best-effort notify via console without causing recursive logging
      const timestamp = new Date().toISOString();
      console.log(`[[WARN]] ${timestamp} - File logging disabled, falling back to console only: ${e.code} ${e.message}`);
    } else {
      // Re-throw unexpected errors to aid debugging
      throw e;
    }
  }
};

// Console output with colors
const consoleOutput = (level, message, data = null) => {
  const timestamp = formatTimestamp();
  let color = colors.reset;
  
  switch (level) {
    case 'ERROR':
      color = colors.red;
      break;
    case 'WARN':
      color = colors.yellow;
      break;
    case 'INFO':
      color = colors.green;
      break;
    case 'DEBUG':
      color = colors.blue;
      break;
  }
  
  const prefix = `${color}[${level}]${colors.reset}`;
  const time = `${colors.cyan}${timestamp}${colors.reset}`;
  const msg = data ? `${message} ${JSON.stringify(data)}` : message;
  
  console.log(`${prefix} ${time} - ${msg}`);
};

// Main logger functions
const logger = {
  error: (message, data = null) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const formatted = formatMessage('ERROR', message, data);
      consoleOutput('ERROR', message, data);
      writeToFile('error.log', formatted);
    }
  },

  warn: (message, data = null) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      const formatted = formatMessage('WARN', message, data);
      consoleOutput('WARN', message, data);
      writeToFile('warn.log', formatted);
    }
  },

  info: (message, data = null) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      const formatted = formatMessage('INFO', message, data);
      consoleOutput('INFO', message, data);
      writeToFile('info.log', formatted);
    }
  },

  debug: (message, data = null) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      const formatted = formatMessage('DEBUG', message, data);
      consoleOutput('DEBUG', message, data);
      writeToFile('debug.log', formatted);
    }
  },

  // Specialized logging functions
  api: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    logger.info('API Request', logData);
  },

  email: (action, data) => {
    logger.info(`Email ${action}`, data);
  },

  followUp: (action, data) => {
    logger.info(`Follow-up ${action}`, data);
  },

  db: (action, data) => {
    logger.debug(`Database ${action}`, data);
  },

  // Performance logging
  performance: (operation, duration, data = {}) => {
    const logData = {
      operation,
      duration: `${duration}ms`,
      ...data
    };
    
    if (duration > 1000) {
      logger.warn('Slow operation detected', logData);
    } else {
      logger.debug('Performance metric', logData);
    }
  },

  // Security logging
  security: (event, data) => {
    logger.warn(`Security: ${event}`, data);
    writeToFile('security.log', formatMessage('WARN', `Security: ${event}`, data));
  },

  // Get log files info
  getLogStats: () => {
    if (!fileLoggingEnabled) return {};
    try {
      const files = fs.readdirSync(logsDir);
      const stats = {};
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stat = fs.statSync(filePath);
        stats[file] = {
          size: stat.size,
          modified: stat.mtime
        };
      });
      return stats;
    } catch (e) {
      return {};
    }
  },

  // Clean old logs (keep last 7 days)
  cleanOldLogs: () => {
    if (!fileLoggingEnabled) return;
    try {
      const files = fs.readdirSync(logsDir);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtime < sevenDaysAgo) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned old log file: ${file}`);
        }
      });
    } catch (_e) {
      // ignore
    }
  }
};

module.exports = logger;