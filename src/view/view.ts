/** @packageDocumentation @publicapi @module view */
import { equals, applyPairs, removeFrom, TypedMap, inArray, find, values, pairs } from '../common/common';
import { curry, prop } from '../common/hof';
import { isString, isArray } from '../common/predicates';
import { trace } from '../common/trace';
import { PathNode } from '../path/pathNode';
import { ActiveUIView, ViewContext, ViewConfig } from './interface';
import { _ViewDeclaration } from '../state/interface';
import { UIRouter } from '../router';

export type ViewConfigFactory = (path: PathNode[], decl: _ViewDeclaration) => ViewConfig | ViewConfig[];

export interface ViewServicePluginAPI {
  _rootViewContext(context?: ViewContext): ViewContext;
  _viewConfigFactory(viewType: string, factory: ViewConfigFactory);
  /** @param id router.$id + "." + uiView.id */
  _registeredUIView(id: string): ActiveUIView;
  _registeredUIViews(): ActiveUIView[];
  _activeViewConfigs(): ViewConfig[];
  _onSync(listener: ViewSyncListener): Function;
}

// A uiView and its matching viewConfig
export interface ViewTuple {
  uiView: ActiveUIView;
  viewConfig: ViewConfig;
}

export interface ViewSyncListener {
  (viewTuples: ViewTuple[]): void;
}

/**
 * The View service
 *
 * This service pairs existing `ui-view` components (from the component tree)
 * with view configs (from the state declaration objects: [[StateDeclaration.views]]).
 *
 * - After a successful Transition, the views from the newly entered states are activated via [[activateViewConfig]].
 *   The views from exited states are deactivated via [[deactivateViewConfig]].
 *   (See: the [[registerActivateViews]] Transition Hook)
 *
 * - As `ui-view` components pop in and out of existence, they register themselves using [[registerUIView]].
 *
 * - When the [[sync]] function is called, the registered `ui-view`(s) ([[ActiveUIView]])
 * are configured with the matching [[ViewConfig]](s)
 *
 */
export class ViewService {
  /** @hidden */ private _uiViewParents: { [viewId: string]: string } = {};
  /** @hidden */ private _registeredViewsById: { [viewId: string]: ActiveUIView } = {};
  /** @hidden */ private _viewConfigs: ViewConfig[] = [];
  /** @hidden */ private _rootContext: ViewContext;
  /** @hidden */ private _viewConfigFactories: { [key: string]: ViewConfigFactory } = {};
  /** @hidden */ private _listeners: ViewSyncListener[] = [];
  /** @hidden */ private _uiViewCounter = 0;

  /** @internalapi */
  public _pluginapi: ViewServicePluginAPI = {
    _rootViewContext: this._rootViewContext.bind(this),
    _viewConfigFactory: this._viewConfigFactory.bind(this),
    _registeredUIView: (id: string) => this._registeredViewsById[id],
    _registeredUIViews: () => values(this._registeredViewsById),
    _activeViewConfigs: () => this._viewConfigs,
    _onSync: (listener: ViewSyncListener) => {
      this._listeners.push(listener);
      return () => removeFrom(this._listeners, listener);
    },
  };

  /**
   * Given a ui-view and a ViewConfig, determines if they "match".
   *
   * A ui-view has a fully qualified name (fqn) and a context object.  The fqn is built from its overall location in
   * the DOM, describing its nesting relationship to any parent ui-view tags it is nested inside of.
   *
   * A ViewConfig has a target ui-view name and a context anchor.  The ui-view name can be a simple name, or
   * can be a segmented ui-view path, describing a portion of a ui-view fqn.
   *
   * In order for a ui-view to match ViewConfig, ui-view's $type must match the ViewConfig's $type
   *
   * If the ViewConfig's target ui-view name is a simple name (no dots), then a ui-view matches if:
   * - the ui-view's name matches the ViewConfig's target name
   * - the ui-view's context matches the ViewConfig's anchor
   *
   * If the ViewConfig's target ui-view name is a segmented name (with dots), then a ui-view matches if:
   * - There exists a parent ui-view where:
   *    - the parent ui-view's name matches the first segment (index 0) of the ViewConfig's target name
   *    - the parent ui-view's context matches the ViewConfig's anchor
   * - And the remaining segments (index 1..n) of the ViewConfig's target name match the tail of the ui-view's fqn
   *
   * Example:
   *
   * DOM:
   * <ui-view>                        <!-- created in the root context (name: "") -->
   *   <ui-view name="foo">                <!-- created in the context named: "A"      -->
   *     <ui-view>                    <!-- created in the context named: "A.B"    -->
   *       <ui-view name="bar">            <!-- created in the context named: "A.B.C"  -->
   *       </ui-view>
   *     </ui-view>
   *   </ui-view>
   * </ui-view>
   *
   * uiViews: [
   *  { fqn: "$default",                  creationContext: { name: "" } },
   *  { fqn: "$default.foo",              creationContext: { name: "A" } },
   *  { fqn: "$default.foo.$default",     creationContext: { name: "A.B" } }
   *  { fqn: "$default.foo.$default.bar", creationContext: { name: "A.B.C" } }
   * ]
   *
   * These four view configs all match the ui-view with the fqn: "$default.foo.$default.bar":
   *
   * - ViewConfig1: { uiViewName: "bar",                       uiViewContextAnchor: "A.B.C" }
   * - ViewConfig2: { uiViewName: "$default.bar",              uiViewContextAnchor: "A.B" }
   * - ViewConfig3: { uiViewName: "foo.$default.bar",          uiViewContextAnchor: "A" }
   * - ViewConfig4: { uiViewName: "$default.foo.$default.bar", uiViewContextAnchor: "" }
   *
   * Using ViewConfig3 as an example, it matches the ui-view with fqn "$default.foo.$default.bar" because:
   * - The ViewConfig's segmented target name is: [ "foo", "$default", "bar" ]
   * - There exists a parent ui-view (which has fqn: "$default.foo") where:
   *    - the parent ui-view's name "foo" matches the first segment "foo" of the ViewConfig's target name
   *    - the parent ui-view's context "A" matches the ViewConfig's anchor context "A"
   * - And the remaining segments [ "$default", "bar" ].join("."_ of the ViewConfig's target name match
   *   the tail of the ui-view's fqn "default.bar"
   *
   * @internalapi
   */
  static matches = (uiViewsByFqn: TypedMap<ActiveUIView>, uiView: ActiveUIView) => (viewConfig: ViewConfig) => {
    // Don't supply an ng1 ui-view with an ng2 ViewConfig, etc
    if (uiView.$type !== viewConfig.viewDecl.$type) return false;

    // Split names apart from both viewConfig and uiView into segments
    const vc = viewConfig.viewDecl;
    const vcSegments = vc.$uiViewName.split('.');
    const uivSegments = uiView.fqn.split('.');

    // Check if the tails of the segment arrays match. ex, these arrays' tails match:
    // vc: ["foo", "bar"], uiv fqn: ["$default", "foo", "bar"]
    if (!equals(vcSegments, uivSegments.slice(0 - vcSegments.length))) return false;

    // Now check if the fqn ending at the first segment of the viewConfig matches the context:
    // ["$default", "foo"].join(".") == "$default.foo", does the ui-view $default.foo context match?
    const negOffset = 1 - vcSegments.length || undefined;
    const fqnToFirstSegment = uivSegments.slice(0, negOffset).join('.');
    const uiViewContext = uiViewsByFqn[fqnToFirstSegment].creationContext;
    return vc.$uiViewContextAnchor === (uiViewContext && uiViewContext.name);
  };

  /**
   * Normalizes a view's name from a state.views configuration block.
   *
   * This should be used by a framework implementation to calculate the values for
   * [[_ViewDeclaration.$uiViewName]] and [[_ViewDeclaration.$uiViewContextAnchor]].
   *
   * @param context the context object (state declaration) that the view belongs to
   * @param rawViewName the name of the view, as declared in the [[StateDeclaration.views]]
   *
   * @returns the normalized uiViewName and uiViewContextAnchor that the view targets
   */
  static normalizeUIViewTarget(context: ViewContext, rawViewName = '') {
    // TODO: Validate incoming view name with a regexp to allow:
    // ex: "view.name@foo.bar" , "^.^.view.name" , "view.name@^.^" , "" ,
    // "@" , "$default@^" , "!$default.$default" , "!foo.bar"
    const viewAtContext: string[] = rawViewName.split('@');
    let uiViewName = viewAtContext[0] || '$default'; // default to unnamed view
    let uiViewContextAnchor = isString(viewAtContext[1]) ? viewAtContext[1] : '^'; // default to parent context

    // Handle relative view-name sugar syntax.
    // Matches rawViewName "^.^.^.foo.bar" into array: ["^.^.^.foo.bar", "^.^.^", "foo.bar"],
    const relativeViewNameSugar = /^(\^(?:\.\^)*)\.(.*$)/.exec(uiViewName);
    if (relativeViewNameSugar) {
      // Clobbers existing contextAnchor (rawViewName validation will fix this)
      uiViewContextAnchor = relativeViewNameSugar[1]; // set anchor to "^.^.^"
      uiViewName = relativeViewNameSugar[2]; // set view-name to "foo.bar"
    }

    if (uiViewName.charAt(0) === '!') {
      uiViewName = uiViewName.substr(1);
      uiViewContextAnchor = ''; // target absolutely from root
    }

    // handle parent relative targeting "^.^.^"
    const relativeMatch = /^(\^(?:\.\^)*)$/;
    if (relativeMatch.exec(uiViewContextAnchor)) {
      const anchorState = uiViewContextAnchor.split('.').reduce((anchor, x) => anchor.parent, context);
      uiViewContextAnchor = anchorState.name;
    } else if (uiViewContextAnchor === '.') {
      uiViewContextAnchor = context.name;
    }

    return { uiViewName, uiViewContextAnchor };
  }

  /** @hidden */
  constructor(/** @hidden */ private router: UIRouter) {}

  /** @hidden */
  private _rootViewContext(context?: ViewContext): ViewContext {
    return (this._rootContext = context || this._rootContext);
  }
  /** @hidden */
  private _viewConfigFactory(viewType: string, factory: ViewConfigFactory) {
    this._viewConfigFactories[viewType] = factory;
  }

  createViewConfig(path: PathNode[], decl: _ViewDeclaration): ViewConfig[] {
    const cfgFactory = this._viewConfigFactories[decl.$type];
    if (!cfgFactory) throw new Error('ViewService: No view config factory registered for type ' + decl.$type);
    const cfgs = cfgFactory(path, decl);
    return isArray(cfgs) ? cfgs : [cfgs];
  }

  /**
   * Deactivates a ViewConfig.
   *
   * This function deactivates a `ViewConfig`.
   * After calling [[sync]], it will un-pair from any `ui-view` with which it is currently paired.
   *
   * @param viewConfig The ViewConfig view to deregister.
   */
  deactivateViewConfig(viewConfig: ViewConfig) {
    trace.traceViewServiceEvent('<- Removing', viewConfig);
    removeFrom(this._viewConfigs, viewConfig);
  }

  activateViewConfig(viewConfig: ViewConfig) {
    trace.traceViewServiceEvent('-> Registering', <any>viewConfig);
    this._viewConfigs.push(viewConfig);
  }

  sync() {
    const uiViewsByFqn: TypedMap<ActiveUIView> = values(this._registeredViewsById)
      .map(uiv => [uiv.fqn, uiv])
      .reduce(applyPairs, <any>{});

    // Return a weighted depth value for a uiView.
    // The depth is the nesting depth of ui-views (based on FQN; times 10,000)
    // plus the depth of the state that is populating the uiView
    function uiViewDepth(uiView: ActiveUIView) {
      const stateDepth = (context: ViewContext) => (context && context.parent ? stateDepth(context.parent) + 1 : 1);
      return uiView.fqn.split('.').length * 10000 + stateDepth(uiView.creationContext);
    }

    // Return the ViewConfig's context's depth in the context tree.
    function viewConfigDepth(config: ViewConfig) {
      let context: ViewContext = config.viewDecl.$context,
        count = 0;
      while (++count && context.parent) context = context.parent;
      return count;
    }

    // Given a depth function, returns a compare function which can return either ascending or descending order
    const depthCompare = curry((depthFn, posNeg, left, right) => posNeg * (depthFn(left) - depthFn(right)));

    const matchingConfigPair = (uiView: ActiveUIView): ViewTuple => {
      const matchingConfigs = this._viewConfigs.filter(ViewService.matches(uiViewsByFqn, uiView));
      if (matchingConfigs.length > 1) {
        // This is OK.  Child states can target a ui-view that the parent state also targets (the child wins)
        // Sort by depth and return the match from the deepest child
        // console.log(`Multiple matching view configs for ${uiView.fqn}`, matchingConfigs);
        matchingConfigs.sort(depthCompare(viewConfigDepth, -1)); // descending
      }
      return { uiView, viewConfig: matchingConfigs[0] };
    };

    const configureUIView = (tuple: ViewTuple) => {
      // If a parent ui-view is reconfigured, it could destroy child ui-views.
      // Before configuring a child ui-view, make sure it's still in the active uiViews array.
      if (values(this._registeredViewsById).indexOf(tuple.uiView) !== -1) tuple.uiView.configUpdated(tuple.viewConfig);
    };

    // Sort views by FQN and state depth. Process uiviews nearest the root first.
    const uiViewTuples = values(this._registeredViewsById)
      .sort(depthCompare(uiViewDepth, 1))
      .map(matchingConfigPair);
    const matchedViewConfigs = uiViewTuples.map(tuple => tuple.viewConfig);
    const unmatchedConfigTuples = this._viewConfigs
      .filter(config => !inArray(matchedViewConfigs, config))
      .map(viewConfig => ({ uiView: undefined, viewConfig }));

    uiViewTuples.forEach(configureUIView);

    const allTuples: ViewTuple[] = uiViewTuples.concat(unmatchedConfigTuples);
    this._listeners.forEach(cb => cb(allTuples));
    trace.traceViewSync(allTuples);
  }

  /** @deprecated use registerView */
  registerUIView(uiView: ActiveUIView) {
    const getParentId = () => {
      const uiViews = this._registeredViewsById;
      const fqnSegments = uiView.fqn.split('.');
      fqnSegments.pop();
      const parentFqn = fqnSegments.join('.');
      if (parentFqn === '') {
        return null; // root
      }
      const [parentId] = pairs(uiViews).find(pair => (pair[1] as ActiveUIView).fqn === parentFqn) || [];
      if (!parentId) {
        console.error(uiView);
        throw new Error(`Could not find registered parent UIView ${parentFqn} while registering uiView`);
      }
      return parentId;
    };

    return this.registerView(getParentId(), uiView).deregister;
  }

  /**
   * Registers a `ui-view` component
   *
   * When a `ui-view` component is created, it uses this method to register itself.
   * After registration the [[sync]] method is used to ensure all `ui-view` are configured with the proper [[ViewConfig]].
   *
   * Note: the `ui-view` component uses the `ViewConfig` to determine what view should be loaded inside the `ui-view`,
   * and what the view's state context is.
   *
   * Note: There is no corresponding `deregisterUIView`.
   *       A `ui-view` should hang on to the return value of `registerUIView` and invoke it to deregister itself.
   *
   * @param parentViewId The id of the parent uiview for a UIView
   * @param uiView The metadata for a uiview
   * @return a de-registration function used when the view is destroyed.
   */
  registerView(parentViewId: string, uiView: ActiveUIView): { id: string; deregister: () => void } {
    if (parentViewId !== null && !this._registeredViewsById[parentViewId]) {
      console.error(uiView);
      throw new Error(`Tried to register a ui-view but its parent ${parentViewId} is not registered`);
    }

    trace.traceViewServiceUIViewEvent('-> Registering', uiView);

    const fqnAndTypeMatches = (uiv: ActiveUIView) => uiv.fqn === uiView.fqn && uiv.$type === uiView.$type;
    if (values(this._registeredViewsById).find(fqnAndTypeMatches)) {
      trace.traceViewServiceUIViewEvent('!!!! duplicate uiView named:', uiView);
    }

    const viewIdNumber = this._uiViewCounter++;
    uiView.id = viewIdNumber; // backwards compat
    const id = `${this.router.$id}.${viewIdNumber}`;

    this._registeredViewsById[id] = uiView;
    this._uiViewParents[id] = parentViewId;
    this.sync();

    const deregister = () => {
      if (!this._registeredViewsById[id]) {
        trace.traceViewServiceUIViewEvent('Tried removing non-registered uiView', uiView);
        return;
      }
      trace.traceViewServiceUIViewEvent('<- Deregistering', uiView);
      delete this._registeredViewsById[id];
      delete this._uiViewParents[id];
    };

    return { id, deregister };
  }

  /**
   * Returns the list of views currently available on the page, by fully-qualified name.
   *
   * @return {Array} Returns an array of fully-qualified view names.
   */
  available() {
    return values(this._registeredViewsById).map(prop('fqn'));
  }

  /**
   * Returns the list of views on the page containing loaded content.
   *
   * @return {Array} Returns an array of fully-qualified view names.
   */
  active() {
    return values(this._registeredViewsById)
      .filter(prop('$config'))
      .map(prop('name'));
  }
}
