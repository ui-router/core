/** workaround for missing console object in IE9 when dev tools haven't been opened o_O */
/* tslint:disable:no-console */
import { noop } from './common';

const noopConsoleStub = { log: noop, error: noop, table: noop };

function ie9Console(console) {
  const bound = (fn: Function) => Function.prototype.bind.call(fn, console);
  return {
    log: bound(console.log),
    error: bound(console.log),
    table: bound(console.log),
  };
}

function fallbackConsole(console) {
  const log = console.log.bind(console);
  const error = console.error ? console.error.bind(console) : log;
  const table = console.table ? console.table.bind(console) : log;
  return { log, error, table };
}

function getSafeConsole() {
  // @ts-ignore
  const isIE9 = typeof document !== 'undefined' && document.documentMode && document.documentMode === 9;
  if (isIE9) {
    return window && window.console ? ie9Console(window.console) : noopConsoleStub;
  } else if (!console.table || !console.error) {
    return fallbackConsole(console);
  } else {
    return console;
  }
}

export const safeConsole = getSafeConsole();
