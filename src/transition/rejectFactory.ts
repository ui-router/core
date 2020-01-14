/** @packageDocumentation @publicapi @module transition */
'use strict';
import { extend, silentRejection } from '../common/common';
import { stringify } from '../common/strings';
import { is } from '../common/hof';

enum RejectType {
  /**
   * A new transition superseded this one.
   *
   * While this transition was running, a new transition started.
   * This transition is cancelled because it was superseded by new transition.
   */
  SUPERSEDED = 2,

  /**
   * The transition was aborted
   *
   * The transition was aborted by a hook which returned `false`
   */
  ABORTED = 3,

  /**
   * The transition was invalid
   *
   * The transition was never started because it was invalid
   */
  INVALID = 4,

  /**
   * The transition was ignored
   *
   * The transition was ignored because it would have no effect.
   *
   * Either:
   *
   * - The transition is targeting the current state and parameter values
   * - The transition is targeting the same state and parameter values as the currently running transition.
   */
  IGNORED = 5,

  /**
   * The transition errored.
   *
   * This generally means a hook threw an error or returned a rejected promise
   */
  ERROR = 6,
}

export { RejectType };

/** @hidden */
let id = 0;

export class Rejection {
  /** @hidden */
  $id = id++;
  /**
   * The type of the rejection.
   *
   * This value is an number representing the type of transition rejection.
   * If using Typescript, this is a Typescript enum.
   *
   * - [[RejectType.SUPERSEDED]] (`2`)
   * - [[RejectType.ABORTED]] (`3`)
   * - [[RejectType.INVALID]] (`4`)
   * - [[RejectType.IGNORED]] (`5`)
   * - [[RejectType.ERROR]] (`6`)
   *
   */
  type: RejectType;

  /**
   * A message describing the rejection
   */
  message: string;

  /**
   * A detail object
   *
   * This value varies based on the mechanism for rejecting the transition.
   * For example, if an error was thrown from a hook, the `detail` will be the `Error` object.
   * If a hook returned a rejected promise, the `detail` will be the rejected value.
   */
  detail: any;

  /**
   * Indicates if the transition was redirected.
   *
   * When a transition is redirected, the rejection [[type]] will be [[RejectType.SUPERSEDED]] and this flag will be true.
   */
  redirected: boolean;

  /** Returns true if the obj is a rejected promise created from the `asPromise` factory */
  static isRejectionPromise(obj: any): boolean {
    return obj && typeof obj.then === 'function' && is(Rejection)(obj._transitionRejection);
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
    const detailString = (d: any) => (d && d.toString !== Object.prototype.toString ? d.toString() : stringify(d));
    const detail = detailString(this.detail);
    const { $id, type, message } = this;
    return `Transition Rejection($id: ${$id} type: ${type}, message: ${message}, detail: ${detail})`;
  }

  toPromise(): Promise<any> {
    return extend(silentRejection(this), { _transitionRejection: this });
  }
}
