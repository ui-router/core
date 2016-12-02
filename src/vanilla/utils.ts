import {isArray} from "../common/module";
import { LocationServices, LocationConfig, services } from "../common/coreservices";
import { UIRouter } from "../router";
import { extend, pushTo, removeFrom } from "../common/common";

const beforeAfterSubstr = (char: string) => (str: string): string[] => {
  if (!str) return ["", ""];
  let idx = str.indexOf(char);
  if (idx === -1) return [str, ""];
  return [str.substr(0, idx), str.substr(idx + 1)];
};

export const splitHash = beforeAfterSubstr("#");
export const splitQuery = beforeAfterSubstr("?");
export const splitEqual = beforeAfterSubstr("=");
export const trimHashVal = (str):string => str ? str.replace(/^#/, "") : "";

export const keyValsToObjectR = (accum, [key, val]) => {
  if (!accum.hasOwnProperty(key)) {
    accum[key] = val;
  } else if (isArray(accum[key])) {
    accum[key].push(val);
  } else {
    accum[key] = [accum[key], val]
  }
  return accum;
};

export const getParams = (queryString: string): any =>
  queryString.split("&").map(splitEqual).reduce(keyValsToObjectR, {});

export function locationPluginFactory(name: string, service: LocationServices, configuration: LocationConfig) {
  let deregFns: Function[] = [];
  function dispose() {
    deregFns.forEach(fn => {
      typeof fn === 'function' && fn();
      removeFrom(deregFns, fn);
    });
  }

  return function(router: UIRouter) {
    extend(services.locationConfig, configuration);
    extend(services.location, service);
    services.location.onChange = (cb: Function) =>
        pushTo(deregFns, service.onChange(cb));
    return { name, service, configuration, dispose };
  };
}
