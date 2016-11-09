/** @coreapi @module core */ /** */
import {UrlMatcherFactory} from "./url/urlMatcherFactory";
import {UrlRouterProvider} from "./url/urlRouter";
import {UrlRouter} from "./url/urlRouter";
import {TransitionService} from "./transition/transitionService";
import {ViewService} from "./view/view";
import {StateRegistry} from "./state/stateRegistry";
import {StateService} from "./state/stateService";
import {UIRouterGlobals, Globals} from "./globals";

/**
 * The master class used to instantiate an instance of UI-Router.
 *
 * UI-Router (for a specific framework) will create an instance of this class during bootstrap.
 * This class instantiates and wires the UI-Router services together.
 *
 * After a new instance of the UIRouter class is created, it should be configured for your app.
 * For instance, app states should be registered with the [[stateRegistry]].
 *
 * Tell UI-Router to monitor the URL by calling `uiRouter.urlRouter.listen()` ([[UrlRouter.listen]])
 */
export class UIRouter {
  viewService = new ViewService();

  transitionService: TransitionService = new TransitionService(this);

  globals: UIRouterGlobals = new Globals(this.transitionService);

  urlMatcherFactory: UrlMatcherFactory = new UrlMatcherFactory();

  urlRouterProvider: UrlRouterProvider = new UrlRouterProvider(this.urlMatcherFactory, this.globals.params);

  urlRouter: UrlRouter = new UrlRouter(this.urlRouterProvider);

  stateRegistry: StateRegistry = new StateRegistry(this.urlMatcherFactory, this.urlRouterProvider);

  stateService = new StateService(this);

  constructor() {
    this.viewService.rootContext(this.stateRegistry.root());
    this.globals.$current = this.stateRegistry.root();
    this.globals.current = this.globals.$current.self;
  }
}

