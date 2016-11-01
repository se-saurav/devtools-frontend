/*
 * Copyright (C) 2007, 2008 Apple Inc.  All rights reserved.
 * Copyright (C) 2008, 2009 Anthony Ricaud <rik@webkit.org>
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
/**
 * @unrestricted
 */
WebInspector.NetworkDataGridNode = class extends WebInspector.SortableDataGridNode {
  /**
   * @param {!WebInspector.NetworkLogView} parentView
   * @param {!WebInspector.NetworkRequest} request
   */
  constructor(parentView, request) {
    super({});
    this._parentView = parentView;
    this._request = request;
    this._staleGraph = true;
    this._isNavigationRequest = false;
    this.selectable = true;
  }

  /**
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static NameComparator(a, b) {
    var aFileName = a._request.name();
    var bFileName = b._request.name();
    if (aFileName > bFileName)
      return 1;
    if (bFileName > aFileName)
      return -1;
    return a._request.indentityCompare(b._request);
  }

  /**
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static RemoteAddressComparator(a, b) {
    var aRemoteAddress = a._request.remoteAddress();
    var bRemoteAddress = b._request.remoteAddress();
    if (aRemoteAddress > bRemoteAddress)
      return 1;
    if (bRemoteAddress > aRemoteAddress)
      return -1;
    return a._request.indentityCompare(b._request);
  }

  /**
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static SizeComparator(a, b) {
    if (b._request.cached() && !a._request.cached())
      return 1;
    if (a._request.cached() && !b._request.cached())
      return -1;
    return (a._request.transferSize - b._request.transferSize) || a._request.indentityCompare(b._request);
  }

  /**
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static TypeComparator(a, b) {
    var aSimpleType = a.displayType();
    var bSimpleType = b.displayType();

    if (aSimpleType > bSimpleType)
      return 1;
    if (bSimpleType > aSimpleType)
      return -1;
    return a._request.indentityCompare(b._request);
  }

  /**
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static InitiatorComparator(a, b) {
    var aInitiator = a._request.initiatorInfo();
    var bInitiator = b._request.initiatorInfo();

    if (aInitiator.type < bInitiator.type)
      return -1;
    if (aInitiator.type > bInitiator.type)
      return 1;

    if (typeof aInitiator.__source === 'undefined')
      aInitiator.__source = WebInspector.displayNameForURL(aInitiator.url);
    if (typeof bInitiator.__source === 'undefined')
      bInitiator.__source = WebInspector.displayNameForURL(bInitiator.url);

    if (aInitiator.__source < bInitiator.__source)
      return -1;
    if (aInitiator.__source > bInitiator.__source)
      return 1;

    if (aInitiator.lineNumber < bInitiator.lineNumber)
      return -1;
    if (aInitiator.lineNumber > bInitiator.lineNumber)
      return 1;

    if (aInitiator.columnNumber < bInitiator.columnNumber)
      return -1;
    if (aInitiator.columnNumber > bInitiator.columnNumber)
      return 1;

    return a._request.indentityCompare(b._request);
  }

  /**
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static RequestCookiesCountComparator(a, b) {
    var aScore = a._request.requestCookies ? a._request.requestCookies.length : 0;
    var bScore = b._request.requestCookies ? b._request.requestCookies.length : 0;
    return (aScore - bScore) || a._request.indentityCompare(b._request);
  }

  /**
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static ResponseCookiesCountComparator(a, b) {
    var aScore = a._request.responseCookies ? a._request.responseCookies.length : 0;
    var bScore = b._request.responseCookies ? b._request.responseCookies.length : 0;
    return (aScore - bScore) || a._request.indentityCompare(b._request);
  }

  /**
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static InitialPriorityComparator(a, b) {
    var priorityMap = WebInspector.NetworkDataGridNode._symbolicToNumericPriority;
    if (!priorityMap) {
      WebInspector.NetworkDataGridNode._symbolicToNumericPriority = new Map();
      priorityMap = WebInspector.NetworkDataGridNode._symbolicToNumericPriority;
      priorityMap.set(NetworkAgent.ResourcePriority.VeryLow, 1);
      priorityMap.set(NetworkAgent.ResourcePriority.Low, 2);
      priorityMap.set(NetworkAgent.ResourcePriority.Medium, 3);
      priorityMap.set(NetworkAgent.ResourcePriority.High, 4);
      priorityMap.set(NetworkAgent.ResourcePriority.VeryHigh, 5);
    }
    var aScore = priorityMap.get(a._request.initialPriority()) || 0;
    var bScore = priorityMap.get(b._request.initialPriority()) || 0;

    return aScore - bScore || a._request.indentityCompare(b._request);
  }

  /**
   * @param {string} propertyName
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static RequestPropertyComparator(propertyName, a, b) {
    var aValue = a._request[propertyName];
    var bValue = b._request[propertyName];
    if (aValue === bValue)
      return a._request.indentityCompare(b._request);
    return aValue > bValue ? 1 : -1;
  }

  /**
   * @param {string} propertyName
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static ResponseHeaderStringComparator(propertyName, a, b) {
    var aValue = String(a._request.responseHeaderValue(propertyName) || '');
    var bValue = String(b._request.responseHeaderValue(propertyName) || '');
    return aValue.localeCompare(bValue) || a._request.indentityCompare(b._request);
  }

  /**
   * @param {string} propertyName
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static ResponseHeaderNumberComparator(propertyName, a, b) {
    var aValue = (a._request.responseHeaderValue(propertyName) !== undefined) ?
        parseFloat(a._request.responseHeaderValue(propertyName)) :
        -Infinity;
    var bValue = (b._request.responseHeaderValue(propertyName) !== undefined) ?
        parseFloat(b._request.responseHeaderValue(propertyName)) :
        -Infinity;
    if (aValue === bValue)
      return a._request.indentityCompare(b._request);
    return aValue > bValue ? 1 : -1;
  }

  /**
   * @param {string} propertyName
   * @param {!WebInspector.NetworkDataGridNode} a
   * @param {!WebInspector.NetworkDataGridNode} b
   * @return {number}
   */
  static ResponseHeaderDateComparator(propertyName, a, b) {
    var aHeader = a._request.responseHeaderValue(propertyName);
    var bHeader = b._request.responseHeaderValue(propertyName);
    var aValue = aHeader ? new Date(aHeader).getTime() : -Infinity;
    var bValue = bHeader ? new Date(bHeader).getTime() : -Infinity;
    if (aValue === bValue)
      return a._request.indentityCompare(b._request);
    return aValue > bValue ? 1 : -1;
  }

  /**
   * @return {string}
   */
  displayType() {
    var mimeType = this._request.mimeType || this._request.requestContentType() || '';
    var resourceType = this._request.resourceType();
    var simpleType = resourceType.name();

    if (resourceType === WebInspector.resourceTypes.Other || resourceType === WebInspector.resourceTypes.Image)
      simpleType = mimeType.replace(/^(application|image)\//, '');

    return simpleType;
  }

  /**
   * @return {!WebInspector.NetworkRequest}
   */
  request() {
    return this._request;
  }

  /**
   * @return {boolean}
   */
  isNavigationRequest() {
    return this._isNavigationRequest;
  }

  markAsNavigationRequest() {
    this._isNavigationRequest = true;
    this.refresh();
  }

  /**
   * @override
   * @return {number}
   */
  nodeSelfHeight() {
    return this._parentView.rowHeight();
  }

  /**
   * @override
   */
  createCells() {
    this._showTiming = !WebInspector.moduleSetting('networkColorCodeResourceTypes').get() &&
        !this._parentView.calculator().startAtZero;
    this._nameCell = null;
    this._timelineCell = null;
    this._initiatorCell = null;

    this._element.classList.toggle('network-error-row', this._isFailed());
    this._element.classList.toggle('network-navigation-row', this._isNavigationRequest);
    super.createCells();

    this._updateGraph();
  }

  /**
   * @param {!Element} element
   * @param {string} text
   */
  _setTextAndTitle(element, text) {
    element.textContent = text;
    element.title = text;
  }

  /**
   * @override
   * @param {string} columnIdentifier
   * @return {!Element}
   */
  createCell(columnIdentifier) {
    var cell = this.createTD(columnIdentifier);
    switch (columnIdentifier) {
      case 'name':
        this._renderNameCell(cell);
        break;
      case 'timeline':
        this._createTimelineBar(cell);
        break;
      case 'method':
        this._setTextAndTitle(cell, this._request.requestMethod);
        break;
      case 'status':
        this._renderStatusCell(cell);
        break;
      case 'protocol':
        this._setTextAndTitle(cell, this._request.protocol);
        break;
      case 'scheme':
        this._setTextAndTitle(cell, this._request.scheme);
        break;
      case 'domain':
        this._setTextAndTitle(cell, this._request.domain);
        break;
      case 'remoteaddress':
        this._setTextAndTitle(cell, this._request.remoteAddress());
        break;
      case 'cookies':
        this._setTextAndTitle(cell, this._arrayLength(this._request.requestCookies));
        break;
      case 'setcookies':
        this._setTextAndTitle(cell, this._arrayLength(this._request.responseCookies));
        break;
      case 'priority':
        this._setTextAndTitle(cell, WebInspector.uiLabelForPriority(this._request.initialPriority()));
        break;
      case 'connectionid':
        this._setTextAndTitle(cell, this._request.connectionId);
        break;
      case 'type':
        this._setTextAndTitle(cell, this.displayType());
        break;
      case 'initiator':
        this._renderInitiatorCell(cell);
        break;
      case 'size':
        this._renderSizeCell(cell);
        break;
      case 'time':
        this._renderTimeCell(cell);
        break;
      default:
        this._setTextAndTitle(cell, this._request.responseHeaderValue(columnIdentifier) || '');
        break;
    }

    return cell;
  }

  /**
   * @param {?Array} array
   * @return {string}
   */
  _arrayLength(array) {
    return array ? '' + array.length : '';
  }

  /**
   * @override
   * @protected
   */
  willAttach() {
    if (this._staleGraph)
      this._updateGraph();
    if (this._initiatorCell && this._request.initiatorInfo().type === WebInspector.NetworkRequest.InitiatorType.Script)
      this._initiatorCell.insertBefore(this._linkifiedInitiatorAnchor, this._initiatorCell.firstChild);
  }

  /**
   * @override
   */
  wasDetached() {
    if (this._linkifiedInitiatorAnchor)
      this._linkifiedInitiatorAnchor.remove();
  }

  dispose() {
    if (this._linkifiedInitiatorAnchor)
      this._parentView.linkifier.disposeAnchor(this._request.target(), this._linkifiedInitiatorAnchor);
  }

  /**
   * @override
   * @param {boolean=} supressSelectedEvent
   */
  select(supressSelectedEvent) {
    super.select(supressSelectedEvent);
    this._parentView.dispatchEventToListeners(WebInspector.NetworkLogView.Events.RequestSelected, this._request);
  }

  /**
   * @param {!RegExp=} regexp
   * @return {!Array.<!Object>}
   */
  highlightMatchedSubstring(regexp) {
    // Ensure element is created.
    this.element();
    var domChanges = [];
    var matchInfo = this._nameCell.textContent.match(regexp);
    if (matchInfo)
      WebInspector.highlightSearchResult(this._nameCell, matchInfo.index, matchInfo[0].length, domChanges);
    return domChanges;
  }

  _openInNewTab() {
    InspectorFrontendHost.openInNewTab(this._request.url);
  }

  /**
   * @param {!Element} cell
   */
  _createTimelineBar(cell) {
    if (Runtime.experiments.isEnabled('canvasNetworkTimeline'))
      return;
    cell = cell.createChild('div');
    this._timelineCell = cell;

    cell.className = 'network-graph-side';

    this._barAreaElement = cell.createChild('div', 'network-graph-bar-area');
    this._barAreaElement.request = this._request;

    if (this._showTiming)
      return;

    var type = this._request.resourceType().name();
    var cached = this._request.cached();

    this._barLeftElement = this._barAreaElement.createChild('div', 'network-graph-bar');
    this._barLeftElement.classList.add(type, 'waiting');
    this._barLeftElement.classList.toggle('cached', cached);

    this._barRightElement = this._barAreaElement.createChild('div', 'network-graph-bar');
    this._barRightElement.classList.add(type);
    this._barRightElement.classList.toggle('cached', cached);

    this._labelLeftElement = this._barAreaElement.createChild('div', 'network-graph-label');
    this._labelLeftElement.classList.add('waiting');

    this._labelRightElement = this._barAreaElement.createChild('div', 'network-graph-label');

    cell.addEventListener('mouseover', this._onMouseOver.bind(this), false);
  }

  /**
   * @param {!Event} event
   */
  _onMouseOver(event) {
    this._refreshLabelPositions();
    this._parentView[WebInspector.NetworkDataGridNode._hoveredRowSymbol] = this;
  }

  /**
   * @return {boolean}
   */
  _isFailed() {
    return (this._request.failed && !this._request.statusCode) || (this._request.statusCode >= 400);
  }

  /**
   * @param {!Element} cell
   */
  _renderNameCell(cell) {
    this._nameCell = cell;
    cell.addEventListener('dblclick', this._openInNewTab.bind(this), false);
    var iconElement;
    if (this._request.resourceType() === WebInspector.resourceTypes.Image) {
      var previewImage = createElementWithClass('img', 'image-network-icon-preview');
      this._request.populateImageSource(previewImage);

      iconElement = createElementWithClass('div', 'icon');
      iconElement.appendChild(previewImage);
    } else {
      iconElement = createElementWithClass('img', 'icon');
    }
    iconElement.classList.add(this._request.resourceType().name());

    cell.appendChild(iconElement);
    cell.createTextChild(this._request.target().decorateLabel(this._request.name()));
    this._appendSubtitle(cell, this._request.path());
    cell.title = this._request.url;
  }

  /**
   * @param {!Element} cell
   */
  _renderStatusCell(cell) {
    cell.classList.toggle(
        'network-dim-cell', !this._isFailed() && (this._request.cached() || !this._request.statusCode));

    if (this._request.failed && !this._request.canceled && !this._request.wasBlocked()) {
      var failText = WebInspector.UIString('(failed)');
      if (this._request.localizedFailDescription) {
        cell.createTextChild(failText);
        this._appendSubtitle(cell, this._request.localizedFailDescription);
        cell.title = failText + ' ' + this._request.localizedFailDescription;
      } else
        this._setTextAndTitle(cell, failText);
    } else if (this._request.statusCode) {
      cell.createTextChild('' + this._request.statusCode);
      this._appendSubtitle(cell, this._request.statusText);
      cell.title = this._request.statusCode + ' ' + this._request.statusText;
    } else if (this._request.parsedURL.isDataURL()) {
      this._setTextAndTitle(cell, WebInspector.UIString('(data)'));
    } else if (this._request.canceled) {
      this._setTextAndTitle(cell, WebInspector.UIString('(canceled)'));
    } else if (this._request.wasBlocked()) {
      var reason = WebInspector.UIString('other');
      switch (this._request.blockedReason()) {
        case NetworkAgent.BlockedReason.Csp:
          reason = WebInspector.UIString('csp');
          break;
        case NetworkAgent.BlockedReason.MixedContent:
          reason = WebInspector.UIString('mixed-content');
          break;
        case NetworkAgent.BlockedReason.Origin:
          reason = WebInspector.UIString('origin');
          break;
        case NetworkAgent.BlockedReason.Inspector:
          reason = WebInspector.UIString('devtools');
          break;
        case NetworkAgent.BlockedReason.Other:
          reason = WebInspector.UIString('other');
          break;
      }
      this._setTextAndTitle(cell, WebInspector.UIString('(blocked:%s)', reason));
    } else if (this._request.finished) {
      this._setTextAndTitle(cell, WebInspector.UIString('Finished'));
    } else {
      this._setTextAndTitle(cell, WebInspector.UIString('(pending)'));
    }
  }

  /**
   * @param {!Element} cell
   */
  _renderInitiatorCell(cell) {
    this._initiatorCell = cell;
    var request = this._request;
    var initiator = request.initiatorInfo();

    if (request.timing && request.timing.pushStart)
      cell.appendChild(createTextNode(WebInspector.UIString('Push / ')));
    switch (initiator.type) {
      case WebInspector.NetworkRequest.InitiatorType.Parser:
        cell.title = initiator.url + ':' + (initiator.lineNumber + 1);
        var uiSourceCode = WebInspector.networkMapping.uiSourceCodeForURLForAnyTarget(initiator.url);
        cell.appendChild(WebInspector.linkifyResourceAsNode(
            initiator.url, initiator.lineNumber, initiator.columnNumber, undefined, undefined,
            uiSourceCode ? uiSourceCode.displayName() : undefined));
        this._appendSubtitle(cell, WebInspector.UIString('Parser'));
        break;

      case WebInspector.NetworkRequest.InitiatorType.Redirect:
        cell.title = initiator.url;
        console.assert(request.redirectSource);
        var redirectSource = /** @type {!WebInspector.NetworkRequest} */ (request.redirectSource);
        cell.appendChild(WebInspector.linkifyRequestAsNode(redirectSource));
        this._appendSubtitle(cell, WebInspector.UIString('Redirect'));
        break;

      case WebInspector.NetworkRequest.InitiatorType.Script:
        if (!this._linkifiedInitiatorAnchor) {
          this._linkifiedInitiatorAnchor = this._parentView.linkifier.linkifyScriptLocation(
              request.target(), initiator.scriptId, initiator.url, initiator.lineNumber, initiator.columnNumber);
          this._linkifiedInitiatorAnchor.title = '';
        }
        cell.appendChild(this._linkifiedInitiatorAnchor);
        this._appendSubtitle(cell, WebInspector.UIString('Script'));
        cell.classList.add('network-script-initiated');
        cell.request = request;
        break;

      default:
        cell.title = WebInspector.UIString('Other');
        cell.classList.add('network-dim-cell');
        cell.appendChild(createTextNode(WebInspector.UIString('Other')));
    }
  }

  /**
   * @param {!Element} cell
   */
  _renderSizeCell(cell) {
    if (this._request.fetchedViaServiceWorker) {
      this._setTextAndTitle(cell, WebInspector.UIString('(from ServiceWorker)'));
      cell.classList.add('network-dim-cell');
    } else if (this._request.cached()) {
      if (this._request.cachedInMemory())
        this._setTextAndTitle(cell, WebInspector.UIString('(from memory cache)'));
      else
        this._setTextAndTitle(cell, WebInspector.UIString('(from disk cache)'));
      cell.classList.add('network-dim-cell');
    } else {
      var resourceSize = Number.bytesToString(this._request.resourceSize);
      var transferSize = Number.bytesToString(this._request.transferSize);
      this._setTextAndTitle(cell, transferSize);
      this._appendSubtitle(cell, resourceSize);
    }
  }

  /**
   * @param {!Element} cell
   */
  _renderTimeCell(cell) {
    if (this._request.duration > 0) {
      this._setTextAndTitle(cell, Number.secondsToString(this._request.duration));
      this._appendSubtitle(cell, Number.secondsToString(this._request.latency));
    } else {
      cell.classList.add('network-dim-cell');
      this._setTextAndTitle(cell, WebInspector.UIString('Pending'));
    }
  }

  /**
   * @param {!Element} cellElement
   * @param {string} subtitleText
   */
  _appendSubtitle(cellElement, subtitleText) {
    var subtitleElement = createElement('div');
    subtitleElement.className = 'network-cell-subtitle';
    subtitleElement.textContent = subtitleText;
    cellElement.appendChild(subtitleElement);
  }

  refreshGraph() {
    if (!this._timelineCell)
      return;
    this._staleGraph = true;
    if (this.attached())
      this.dataGrid.scheduleUpdate();
  }

  _updateTimingGraph() {
    var calculator = this._parentView.calculator();
    var timeRanges =
        WebInspector.RequestTimingView.calculateRequestTimeRanges(this._request, calculator.minimumBoundary());
    var right = timeRanges[0].end;

    var container = this._barAreaElement;
    var nextBar = container.firstChild;
    for (var i = 0; i < timeRanges.length; ++i) {
      var range = timeRanges[i];
      var start = calculator.computePercentageFromEventTime(range.start);
      var end = (range.end !== Number.MAX_VALUE) ? calculator.computePercentageFromEventTime(range.end) : 100;
      if (!nextBar)
        nextBar = container.createChild('div');
      nextBar.className = 'network-graph-bar request-timing';
      nextBar.classList.add(range.name);
      nextBar.style.setProperty('left', start + '%');
      nextBar.style.setProperty('right', (100 - end) + '%');
      nextBar = nextBar.nextSibling;
    }
    while (nextBar) {
      var nextSibling = nextBar.nextSibling;
      nextBar.remove();
      nextBar = nextSibling;
    }
  }

  _updateGraph() {
    this._staleGraph = false;
    if (!this._timelineCell)
      return;
    if (this._showTiming) {
      this._updateTimingGraph();
      return;
    }

    var calculator = this._parentView.calculator();
    var percentages = calculator.computeBarGraphPercentages(this._request);
    this._percentages = percentages;

    this._barAreaElement.classList.remove('hidden');

    this._barLeftElement.style.setProperty('left', percentages.start + '%');
    this._barLeftElement.style.setProperty('right', (100 - percentages.middle) + '%');

    this._barRightElement.style.setProperty('left', percentages.middle + '%');
    this._barRightElement.style.setProperty('right', (100 - percentages.end) + '%');

    var labels = calculator.computeBarGraphLabels(this._request);
    this._labelLeftElement.textContent = labels.left;
    this._labelRightElement.textContent = labels.right;

    var tooltip = (labels.tooltip || '');
    this._barLeftElement.title = tooltip;
    this._labelLeftElement.title = tooltip;
    this._labelRightElement.title = tooltip;
    this._barRightElement.title = tooltip;

    if (this._parentView[WebInspector.NetworkDataGridNode._hoveredRowSymbol] === this)
      this._refreshLabelPositions();
  }

  _refreshLabelPositions() {
    if (!this._percentages)
      return;
    this._labelLeftElement.style.removeProperty('left');
    this._labelLeftElement.style.removeProperty('right');
    this._labelLeftElement.classList.remove('before');
    this._labelLeftElement.classList.remove('hidden');

    this._labelRightElement.style.removeProperty('left');
    this._labelRightElement.style.removeProperty('right');
    this._labelRightElement.classList.remove('after');
    this._labelRightElement.classList.remove('hidden');

    const labelPadding = 10;
    const barRightElementOffsetWidth = this._barRightElement.offsetWidth;
    const barLeftElementOffsetWidth = this._barLeftElement.offsetWidth;

    if (this._barLeftElement) {
      var leftBarWidth = barLeftElementOffsetWidth - labelPadding;
      var rightBarWidth = (barRightElementOffsetWidth - barLeftElementOffsetWidth) - labelPadding;
    } else {
      var leftBarWidth = (barLeftElementOffsetWidth - barRightElementOffsetWidth) - labelPadding;
      var rightBarWidth = barRightElementOffsetWidth - labelPadding;
    }

    const labelLeftElementOffsetWidth = this._labelLeftElement.offsetWidth;
    const labelRightElementOffsetWidth = this._labelRightElement.offsetWidth;

    const labelBefore = (labelLeftElementOffsetWidth > leftBarWidth);
    const labelAfter = (labelRightElementOffsetWidth > rightBarWidth);
    const graphElementOffsetWidth = this._timelineCell.offsetWidth;

    if (labelBefore && (graphElementOffsetWidth * (this._percentages.start / 100)) < (labelLeftElementOffsetWidth + 10))
      var leftHidden = true;

    if (labelAfter &&
        (graphElementOffsetWidth * ((100 - this._percentages.end) / 100)) < (labelRightElementOffsetWidth + 10))
      var rightHidden = true;

    if (barLeftElementOffsetWidth === barRightElementOffsetWidth) {
      // The left/right label data are the same, so a before/after label can be replaced by an on-bar label.
      if (labelBefore && !labelAfter)
        leftHidden = true;
      else if (labelAfter && !labelBefore)
        rightHidden = true;
    }

    if (labelBefore) {
      if (leftHidden)
        this._labelLeftElement.classList.add('hidden');
      this._labelLeftElement.style.setProperty('right', (100 - this._percentages.start) + '%');
      this._labelLeftElement.classList.add('before');
    } else {
      this._labelLeftElement.style.setProperty('left', this._percentages.start + '%');
      this._labelLeftElement.style.setProperty('right', (100 - this._percentages.middle) + '%');
    }

    if (labelAfter) {
      if (rightHidden)
        this._labelRightElement.classList.add('hidden');
      this._labelRightElement.style.setProperty('left', this._percentages.end + '%');
      this._labelRightElement.classList.add('after');
    } else {
      this._labelRightElement.style.setProperty('left', this._percentages.middle + '%');
      this._labelRightElement.style.setProperty('right', (100 - this._percentages.end) + '%');
    }
  }
};

WebInspector.NetworkDataGridNode._hoveredRowSymbol = Symbol('hoveredRow');
