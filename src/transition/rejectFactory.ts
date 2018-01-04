/**
 * @coreapi
 * @module transition
 */ /** for typedoc */
'use strict';
import { extend, silentRejection } from '../common/common';
import { stringify } from '../common/strings';
import { is } from '../common/hof';

export enum RejectType {
  SUPERSEDED = 2, ABORTED = 3, INVALID = 4, IGNORED = 5, ERROR = 6,
}

/** @hidden */
let id = 0;

export class Rejection {
  $id = id++;
  type: number;
  message: string;
  detail: any;
  redirected: boolean;

  /** Returns true if the obj is a rejected promise created from the `asPromise` factory */
  static isRejectionPromise(obj: any): boolean {
    return obj && (typeof obj.then === 'function') && is(Rejection)(obj._transitionRejection);
  }

  /** Returns a Rejection due to transition superseded */
  static superseded(detail?: any, options?: any): Rejection {
    const message = 'The transition has been superseded by a different transition';
    const rejection = new Rejection(RejectType.SUPERSEDED, message, detail);
    if (options && options.redirected) {
      rejection.redirected = true;
    }
    return rejection;
  }

  /** Returns a Rejection due to redirected transition */
  static redirected(detail?: any): Rejection {
    return Rejection.superseded(detail, { redirected: true });
  }

  /** Returns a Rejection due to invalid transition */
  static invalid(detail?: any): Rejection {
    const message = 'This transition is invalid';
    return new Rejection(RejectType.INVALID, message, detail);
  }

  /** Returns a Rejection due to ignored transition */
  static ignored(detail?: any): Rejection {
    const message = 'The transition was ignored';
    return new Rejection(RejectType.IGNORED, message, detail);
  }

  /** Returns a Rejection due to aborted transition */
  static aborted(detail?: any): Rejection {
    const message = 'The transition has been aborted';
    return new Rejection(RejectType.ABORTED, message, detail);
  }

  /** Returns a Rejection due to aborted transition */
  static errored(detail?: any): Rejection {
    const message = 'The transition errored';
    return new Rejection(RejectType.ERROR, message, detail);
  }

  /**
   * Returns a Rejection
   *
   * Normalizes a value as a Rejection.
   * If the value is already a Rejection, returns it.
   * Otherwise, wraps and returns the value as a Rejection (Rejection type: ERROR).
   *
   * @returns `detail` if it is already a `Rejection`, else returns an ERROR Rejection.
   */
  static normalize(detail?: Rejection | Error | any): Rejection {
    return is(Rejection)(detail) ? detail : Rejection.errored(detail);
  }

  constructor(type: number, message?: string, detail?: any) {
    this.type = type;
    this.message = message;
    this.detail = detail;
  }

  toString() {
    const detailString = (d: any) =>
        d && d.toString !== Object.prototype.toString ? d.toString() : stringify(d);
    const detail = detailString(this.detail);
    const { $id, type, message } = this;
    return `Transition Rejection($id: ${$id} type: ${type}, message: ${message}, detail: ${detail})`;
  }

  toPromise(): Promise<any> {
    return extend(silentRejection(this), { _transitionRejection: this });
  }
}
