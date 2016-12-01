import { isArray, isObject, $QLike } from "../common/module";

/** $q-like promise api */
export const $q = {
  when: (val) => new Promise((resolve, reject) => resolve(val)),

  reject: (val) => new Promise((resolve, reject) => { reject(val); }),

  defer: () => {
    let deferred: any = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  },

  all: (promises: { [key: string]: Promise<any> } | Promise<any>[]) => {
    if (isArray(promises)) {
      return new Promise((resolve, reject) => {
        let results = [];
        promises.reduce((wait4, promise) => wait4.then(() => promise.then(val => results.push(val))), $q.when())
          .then(() => { resolve(results); }, reject);
      });
    }

    if (isObject(promises)) {
      // Convert promises map to promises array.
      // When each promise resolves, map it to a tuple { key: key, val: val }
      let chain = Object.keys(promises)
          .map(key => promises[key].then(val => ({key, val})));
      // Then wait for all promises to resolve, and convert them back to an object
      return $q.all(chain).then(values =>
        values.reduce((acc, tuple) => { acc[tuple.key] = tuple.val; return acc; }, {}));
    }
  }
} as $QLike;