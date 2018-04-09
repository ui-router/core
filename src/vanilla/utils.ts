/**
 * @internalapi
 * @module vanilla
 */
/** */
import {
  LocationConfig,
  LocationServices,
  identity,
  unnestR,
  isArray,
  splitEqual,
  splitHash,
  splitQuery,
} from '../common';
import { UIRouter } from '../router';

export const keyValsToObjectR = (accum, [key, val]) => {
  if (!accum.hasOwnProperty(key)) {
    accum[key] = val;
  } else if (isArray(accum[key])) {
    accum[key].push(val);
  } else {
    accum[key] = [accum[key], val];
  }
  return accum;
};

export const getParams = (queryString: string): any =>
  queryString
    .split('&')
    .filter(identity)
    .map(splitEqual)
    .reduce(keyValsToObjectR, {});

export function parseUrl(url: string) {
  const orEmptyString = x => x || '';
  const [beforehash, hash] = splitHash(url).map(orEmptyString);
  const [path, search] = splitQuery(beforehash).map(orEmptyString);

  return { path, search, hash, url };
}

export const buildUrl = (loc: LocationServices) => {
  const path = loc.path();
  const searchObject = loc.search();
  const hash = loc.hash();

  const search = Object.keys(searchObject)
    .map(key => {
      const param = searchObject[key];
      const vals = isArray(param) ? param : [param];
      return vals.map(val => key + '=' + val);
    })
    .reduce(unnestR, [])
    .join('&');

  return path + (search ? '?' + search : '') + (hash ? '#' + hash : '');
};

export function locationPluginFactory(
  name: string,
  isHtml5: boolean,
  serviceClass: { new (uiRouter?: UIRouter): LocationServices },
  configurationClass: { new (uiRouter?: UIRouter, isHtml5?: boolean): LocationConfig },
) {
  return function(uiRouter: UIRouter) {
    const service = (uiRouter.locationService = new serviceClass(uiRouter));
    const configuration = (uiRouter.locationConfig = new configurationClass(uiRouter, isHtml5));

    function dispose(router: UIRouter) {
      router.dispose(service);
      router.dispose(configuration);
    }

    return { name, service, configuration, dispose };
  };
}
