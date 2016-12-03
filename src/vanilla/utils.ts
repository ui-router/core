/** @internalapi @module vanilla */ /** */
import {isArray} from "../common/module";
import { LocationServices, LocationConfig, services } from "../common/coreservices";
import { UIRouter } from "../router";
import { extend, bindFunctions } from "../common/common";

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

export function locationPluginFactory(
    name: string,
    serviceClass: { new(router?: UIRouter): LocationServices },
    configurationClass: { new(router?: UIRouter): LocationConfig }
) {
  return function(router: UIRouter) {
    let service = new serviceClass(router);
    let configuration = new configurationClass(router);

    function dispose(router: UIRouter) {
      router.dispose(service);
      router.dispose(configuration);
    }

    bindFunctions(serviceClass.prototype, services.location, service);
    bindFunctions(configurationClass.prototype, services.locationConfig, configuration);

    return { name, service, configuration, dispose };
  };
}
