/**
 * @internalapi
 * @module vanilla
 */ /** */
import {isArray} from "../common/index";
import { LocationServices, LocationConfig } from "../common/coreservices";
import { UIRouter } from "../router";
import { identity, unnestR } from "../common/common";

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
    queryString.split("&").filter(identity).map(splitEqual).reduce(keyValsToObjectR, {});

export const buildUrl = (loc: LocationServices) => {
  let path = loc.path();
  let searchObject = loc.search();
  let hash = loc.hash();

  let search = Object.keys(searchObject).map(key => {
    let param = searchObject[key];
    let vals = isArray(param) ? param : [param];
    return vals.map(val => key + "=" + val);
  }).reduce(unnestR, []).join("&");

  return path + (search ? "?" + search : "") + (hash ? "#" + hash : "");
};

export function locationPluginFactory(
    name: string,
    isHtml5: boolean,
    serviceClass: { new(router?: UIRouter): LocationServices },
    configurationClass: { new(router?: UIRouter, isHtml5?: boolean): LocationConfig }
) {
  return function(router: UIRouter) {
    let service       = router.locationService = new serviceClass(router);
    let configuration = router.locationConfig  = new configurationClass(router, isHtml5);

    function dispose(router: UIRouter) {
      router.dispose(service);
      router.dispose(configuration);
    }

    return { name, service, configuration, dispose };
  };
}
