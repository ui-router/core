/** @packageDocumentation @internalapi @module vanilla */
import { isArray, isObject, $QLike } from '../common/index';

/**
 * An angular1-like promise api
 *
 * This object implements four methods similar to the
 * [angular 1 promise api](https://docs.angularjs.org/api/ng/service/$q)
 *
 * UI-Router evolved from an angular 1 library to a framework agnostic library.
 * However, some of the `@uirouter/core` code uses these ng1 style APIs to support ng1 style dependency injection.
 *
 * This API provides native ES6 promise support wrapped as a $q-like API.
 * Internally, UI-Router uses this $q object to perform promise operations.
 * The `angular-ui-router` (ui-router for angular 1) uses the $q API provided by angular.
 *
 * $q-like promise api
 */
export const $q = {
  /** Normalizes a value as a promise */
  when: val => new Promise((resolve, reject) => resolve(val)),

  /** Normalizes a value as a promise rejection */
  reject: val =>
    new Promise((resolve, reject) => {
      reject(val);
    }),

  /** @returns a deferred object, which has `resolve` and `reject` functions */
  defer: () => {
    const deferred: any = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  },

  /** Like Promise.all(), but also supports object key/promise notation like $q */
  all: (promises: { [key: string]: Promise<any> } | Promise<any>[]) => {
    if (isArray(promises)) {
      return Promise.all(promises);
    }

    if (isObject(promises)) {
      // Convert promises map to promises array.
      // When each promise resolves, map it to a tuple { key: key, val: val }
      const chain = Object.keys(promises).map(key => promises[key].then(val => ({ key, val })));

      // Then wait for all promises to resolve, and convert them back to an object
      return $q.all(chain).then(values =>
        values.reduce((acc, tuple) => {
          acc[tuple.key] = tuple.val;
          return acc;
        }, {})
      );
    }
  },
} as $QLike;
