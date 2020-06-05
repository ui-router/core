import { Disposable } from '../interface';
import { UIRouter } from '../router';
import { ParamTypeDefinition, ParamTypes } from '../params';
import { isDefined, isString } from '../common';

/**
 * An API to customize the URL behavior and retrieve URL configuration
 *
 * This API is used to customize the behavior of the URL.
 * This includes optional trailing slashes ([[strictMode]]), case sensitivity ([[caseInsensitive]]),
 * and custom parameter encoding (custom [[type]]).
 *
 * It also has information about the location (url) configuration such as [[port]] and [[baseHref]].
 * This information can be used to build absolute URLs, such as
 * `https://example.com:443/basepath/state/substate?param1=a#hashvalue`;
 *
 * This API is found at `router.urlService.config` (see: [[UIRouter.urlService]], [[URLService.config]])
 */
export class UrlConfig implements Disposable {
  /** @internal */ paramTypes = new ParamTypes();
  /** @internal */ _isCaseInsensitive = false;
  /** @internal */ _isStrictMode = true;
  /** @internal */ _defaultSquashPolicy: boolean | string = false;

  /** @internal */ constructor(/** @internal */ private router: UIRouter) {}
  /** @internal */ public dispose = () => this.paramTypes.dispose();

  // Delegate these calls to the current LocationConfig implementation

  /**
   * Gets the base Href, e.g., `http://localhost/approot/`
   *
   * @return the application's base href
   */
  public baseHref = (): string => this.router.locationConfig.baseHref();

  /**
   * Gets or sets the hashPrefix
   *
   * This only applies when not running in [[html5Mode]] (pushstate mode)
   *
   * If the current url is `http://localhost/app#!/uirouter/path/#anchor`, it returns `!` which is the prefix for the "hashbang" portion.
   *
   * @return the hash prefix
   */

  public hashPrefix = (newprefix?: string): string => this.router.locationConfig.hashPrefix(newprefix);
  /**
   * Gets the host, e.g., `localhost`
   *
   * @return the protocol
   */
  public host = (): string => this.router.locationConfig.host();

  /**
   * Returns true when running in pushstate mode
   *
   * @return true when running in html5 mode (pushstate mode).
   */
  public html5Mode = (): boolean => this.router.locationConfig.html5Mode();

  /**
   * Gets the port, e.g., `80`
   *
   * @return the port number
   */
  public port = (): number => this.router.locationConfig.port();

  /**
   * Gets the protocol, e.g., `http`
   *
   * @return the protocol
   */
  public protocol = (): string => this.router.locationConfig.protocol();

  /**
   * Defines whether URL matching should be case sensitive (the default behavior), or not.
   *
   * #### Example:
   * ```js
   * // Allow case insensitive url matches
   * urlService.config.caseInsensitive(true);
   * ```
   *
   * @param value `false` to match URL in a case sensitive manner; otherwise `true`;
   * @returns the current value of caseInsensitive
   */
  public caseInsensitive(value?: boolean): boolean {
    return (this._isCaseInsensitive = isDefined(value) ? value : this._isCaseInsensitive);
  }

  /**
   * Sets the default behavior when generating or matching URLs with default parameter values.
   *
   * #### Example:
   * ```js
   * // Remove default parameter values from the url
   * urlService.config.defaultSquashPolicy(true);
   * ```
   *
   * @param value A string that defines the default parameter URL squashing behavior.
   *    - `nosquash`: When generating an href with a default parameter value, do not squash the parameter value from the URL
   *    - `slash`: When generating an href with a default parameter value, squash (remove) the parameter value, and, if the
   *      parameter is surrounded by slashes, squash (remove) one slash from the URL
   *    - any other string, e.g. "~": When generating an href with a default parameter value, squash (remove)
   *      the parameter value from the URL and replace it with this string.
   * @returns the current value of defaultSquashPolicy
   */
  public defaultSquashPolicy(value?: boolean | string) {
    if (isDefined(value) && value !== true && value !== false && !isString(value))
      throw new Error(`Invalid squash policy: ${value}. Valid policies: false, true, arbitrary-string`);
    return (this._defaultSquashPolicy = isDefined(value) ? value : this._defaultSquashPolicy);
  }

  /**
   * Defines whether URLs should match trailing slashes, or not (the default behavior).
   *
   * #### Example:
   * ```js
   * // Allow optional trailing slashes
   * urlService.config.strictMode(false);
   * ```
   *
   * @param value `false` to match trailing slashes in URLs, otherwise `true`.
   * @returns the current value of strictMode
   */
  public strictMode(value?: boolean): boolean {
    return (this._isStrictMode = isDefined(value) ? value : this._isStrictMode);
  }

  /**
   * Creates and registers a custom [[ParamType]] object
   *
   * A custom parameter type can be used to generate URLs with typed parameters or custom encoding/decoding.
   *
   * #### Note: Register custom types *before using them* in a state definition.
   *
   * #### Example:
   * ```js
   * // Encode object parameter as JSON string
   * urlService.config.type('myjson', {
   *   encode: (obj) => JSON.stringify(obj),
   *   decode: (str) => JSON.parse(str),
   *   is: (val) => typeof(val) === 'object',
   *   pattern: /[^/]+/,
   *   equals: (a, b) => _.isEqual(a, b),
   * });
   * ```
   *
   * See [[ParamTypeDefinition]] for more examples
   *
   * @param name The type name.
   * @param definition The type definition. See [[ParamTypeDefinition]] for information on the values accepted.
   * @param definitionFn A function that is injected before the app runtime starts.
   *        The result of this function should be a [[ParamTypeDefinition]].
   *        The result is merged into the existing `definition`.
   *        See [[ParamType]] for information on the values accepted.
   *
   * @returns if only the `name` parameter was specified: the currently registered [[ParamType]] object, or undefined
   */
  type(name: string, definition?: ParamTypeDefinition, definitionFn?: () => ParamTypeDefinition) {
    const type = this.paramTypes.type(name, definition, definitionFn);
    return !isDefined(definition) ? type : this;
  }
}
