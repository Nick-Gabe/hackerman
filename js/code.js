const code = [
`function isCompatible(ua) {
    return !!((function() {
        'use strict';
        return !this && Function.prototype.bind;
    }()) 
    && 'querySelector' in document
    && 'localStorage' in window
    && !ua.match(/MSIE 10|NetFront|Opera Mini|S40OviBrowser|MeeGo|Android.+Glass|^Mozilla\/5\.0 .+ Gecko\/$|googleweblight|PLAYSTATION|PlayStation/));
}
if (!isCompatible(navigator.userAgent)) {
    document.documentElement.className = document.documentElement.className.replace(/(^|\s)client-js(\s|$)/, '$1client-nojs$2');
    while (window.NORLQ && NORLQ[0]) {
        NORLQ.shift()();
    }
    NORLQ = {
        push: function(fn) {
            fn();
        }
    };
    RLQ = {
        push: function() {}
    };
} else {
    if (window.performance && performance.mark) {
        performance.mark('mwStartup');
    }(function() {
        'use strict';
        var mw, log, con = window.console;

        function logError(topic, data) {
            var msg, e = data.exception;
            if (con.log) {
                msg = (e ? 'Exception' : 'Error') + ' in ' + data.source + (data.module ? ' in module ' + data.module : '') + (e ? ':' : '.');
                con.log(msg);
                if (e && con.warn) {
                    con.warn(e);
                }
            }
        }

        function Map() {
            this.values = Object.create(null);
        }
        Map.prototype = {
            constructor: Map,
            get: function(selection, fallback) {
                var results, i;
                fallback = arguments.length > 1 ? fallback : null;
                if (Array.isArray(selection)) {
                    results = {};
                    for (i = 0; i < selection.length; i++) {
                        if (typeof selection[i] === 'string') {
                            results[selection[i]] = selection[i] in this.values ? this.values[selection[i]] : fallback;
                        }
                    }
                    return results;
                }
                if (typeof selection === 'string') {
                    return selection in this.values ? this.values[selection] : fallback;
                }
                if (selection === undefined) {
                    results = {};
                    for (i in this.values) {
                        results[i] = this.values[i];
                    }
                    return results;
                }
                return fallback;
            },
            set: function(selection, value) {
                if (arguments.length > 1) {
                    if (typeof selection === 'string') {
                        this.values[selection] = value;
                        return true;
                    }
                } else if (typeof selection === 'object') {
                    for (var s in selection) {
                        this.values[s] = selection[s];
                    }
                    return true;
                }
                return false;
            },
            exists: function(selection) {
                return typeof selection === 'string' && selection in this.values;
            }
        };
        log = function() {};
        log.warn = con.warn ? Function.prototype.bind.call(con.warn, con) : function() {};
        mw = {
            now: function() {
                var perf = window.performance,
                    navStart = perf &&
                    perf.timing && perf.timing.navigationStart;
                mw.now = navStart && perf.now ? function() {
                    return navStart + perf.now();
                } : Date.now;
                return mw.now();
            },
            trackQueue: [],
            track: function(topic, data) {
                mw.trackQueue.push({
                    topic: topic,
                    data: data
                });
            },
            trackError: function(topic, data) {
                mw.track(topic, data);
                logError(topic, data);
            },
            Map: Map,
            config: new Map(),
            messages: new Map(),
            templates: new Map(),
            log: log
        };
        window.mw = window.mediaWiki = mw;
    }());
    (function() {
        'use strict';
        var StringSet, store, hasOwn = Object.hasOwnProperty;

        function defineFallbacks() {
            StringSet = window.Set || function() {
                var set = Object.create(null);
                return {
                    add: function(value) {
                        set[value] = true;
                    },
                    has: function(value) {
                        return value in set;
                    }
                };
            };
        }
        defineFallbacks();

        function fnv132(str) {
            var hash = 0x811C9DC5;
            for (var i = 0; i < str.length; i++) {
                hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
                hash ^= str.charCodeAt(i);
            }
            hash = (hash >>> 0).toString(36).slice(0, 5);
            while (hash.length < 5) {
                hash = '0' + hash;
            }
            return hash;
        }
        var isES6Supported = typeof Promise === 'function' && Promise.prototype.finally && /./g.
        flags === 'g' && (function() {
            try {
                new Function('(a = 0) => a');
                return true;
            } catch (e) {
                return false;
            }
        }());
        var registry = Object.create(null),
            sources = Object.create(null),
            handlingPendingRequests = false,
            pendingRequests = [],
            queue = [],
            jobs = [],
            willPropagate = false,
            errorModules = [],
            baseModules = ["jquery", "mediawiki.base"],
            marker = document.querySelector('meta[name="ResourceLoaderDynamicStyles"]'),
            lastCssBuffer, rAF = window.requestAnimationFrame || setTimeout;

        function newStyleTag(text, nextNode) {
            var el = document.createElement('style');
            el.appendChild(document.createTextNode(text));
            if (nextNode && nextNode.parentNode) {
                nextNode.parentNode.insertBefore(el, nextNode);
            } else {
                document.head.appendChild(el);
            }
            return el;
        }

        function flushCssBuffer(cssBuffer) {
            if (cssBuffer === lastCssBuffer) {
                lastCssBuffer = null;
            }
            newStyleTag(cssBuffer.cssText, marker);
            for (var i = 0; i < cssBuffer.callbacks.length; i++) {
                cssBuffer.callbacks[i]();
            }
        }

        function addEmbeddedCSS(cssText, callback) {
            if (!lastCssBuffer || cssText.slice(0, 7) === '@import') {
                lastCssBuffer = {
                    cssText: '',
                    callbacks: []
                };
                rAF(flushCssBuffer.bind(null, lastCssBuffer));
            }
            lastCssBuffer.cssText += '\n' + cssText;
            lastCssBuffer.callbacks.push(callback);
        }

        function getCombinedVersion(modules) {
            var hashes = modules.reduce(function(result, module) {
                return result + registry[module].version;
            }, '');
            return fnv132(hashes);
        }

        function allReady(modules) {
            for (var i = 0; i < modules.length; i++) {
                if (mw.loader.getState(modules[i]) !== 'ready') {
                    return false;
                }
            }
            return true;
        }

        function allWithImplicitReady(module) {
            return allReady(registry[module].dependencies) && (baseModules.indexOf(module) !== -1 || allReady(baseModules));
        }

        function anyFailed(modules) {
            for (var i = 0; i < modules.length; i++) {
                var state = mw.loader.getState(modules[i]);
                if (state === 'error' || state === 'missing') {
                    return modules[i];
                }
            }
            return false;
        }

        function doPropagation() {
            var didPropagate = true;
            var module;
            while (didPropagate) {
                didPropagate = false;
                while (errorModules.length) {
                    var errorModule = errorModules.shift(),
                        baseModuleError = baseModules.indexOf(errorModule) !== -1;
                    for (module in registry) {
                        if (registry[
                                module].state !== 'error' && registry[module].state !== 'missing') {
                            if (baseModuleError && baseModules.indexOf(module) === -1) {
                                registry[module].state = 'error';
                                didPropagate = true;
                            } else if (registry[module].dependencies.indexOf(errorModule) !== -1) {
                                registry[module].state = 'error';
                                errorModules.push(module);
                                didPropagate = true;
                            }
                        }
                    }
                }
                for (module in registry) {
                    if (registry[module].state === 'loaded' && allWithImplicitReady(module)) {
                        execute(module);
                        didPropagate = true;
                    }
                }
                for (var i = 0; i < jobs.length; i++) {
                    var job = jobs[i];
                    var failed = anyFailed(job.dependencies);
                    if (failed !== false || allReady(job.dependencies)) {
                        jobs.splice(i, 1);
                        i -= 1;
                        try {
                            if (failed !== false && job.error) {
                                job.error(new Error('Failed dependency: ' + failed), job.dependencies);
                            } else if (failed === false && job.ready) {
                                job.ready();
                            }
                        } catch (e) {
                            mw.trackError('resourceloader.exception', {
                                exception: e,
                                source: 'load-callback'
                            });
                        }
                        didPropagate = true;
                    }
                }
            }
            willPropagate = false;
        }

        function setAndPropagate(module, state) {
            registry[module].state = state;
            if (state === 'ready') {
                store.add(module);
            } else if (state ===
                'error' || state === 'missing') {
                errorModules.push(module);
            } else if (state !== 'loaded') {
                return;
            }
            if (willPropagate) {
                return;
            }
            willPropagate = true;
            mw.requestIdleCallback(doPropagation, {
                timeout: 1
            });
        }

        function sortDependencies(module, resolved, unresolved) {
            if (!(module in registry)) {
                throw new Error('Unknown module: ' + module);
            }
            if (typeof registry[module].skip === 'string') {
                var skip = (new Function(registry[module].skip)());
                registry[module].skip = !!skip;
                if (skip) {
                    registry[module].dependencies = [];
                    setAndPropagate(module, 'ready');
                    return;
                }
            }
            if (!unresolved) {
                unresolved = new StringSet();
            }
            var deps = registry[module].dependencies;
            unresolved.add(module);
            for (var i = 0; i < deps.length; i++) {
                if (resolved.indexOf(deps[i]) === -1) {
                    if (unresolved.has(deps[i])) {
                        throw new Error('Circular reference detected: ' + module + ' -> ' + deps[i]);
                    }
                    sortDependencies(deps[i], resolved, unresolved);
                }
            }
            resolved.push(module);
        }

        function resolve(modules) {
            var resolved = baseModules.slice();
            for (var i = 0; i < modules.length; i++) {
                sortDependencies(modules[i], resolved);
            }
            return resolved;
        }

        function resolveStubbornly(modules) {
            var resolved = baseModules.slice();
            for (var i = 0; i < modules.length; i++) {
                var saved = resolved.slice();
                try {
                    sortDependencies(modules[i], resolved);
                } catch (err) {
                    resolved = saved;
                    mw.log.warn('Skipped unavailable module ' + modules[i]);
                    if (modules[i] in registry) {
                        mw.trackError('resourceloader.exception', {
                            exception: err,
                            source: 'resolve'
                        });
                    }
                }
            }
            return resolved;
        }

        function resolveRelativePath(relativePath, basePath) {
            var relParts = relativePath.match(/^((?:\.\.?\/)+)(.*)$/);
            if (!relParts) {
                return null;
            }
            var baseDirParts = basePath.split('/');
            baseDirParts.pop();
            var prefixes = relParts[1].split('/');
            prefixes.pop();
            var prefix;
            while ((prefix = prefixes.pop()) !== undefined) {
                if (prefix === '..') {
                    baseDirParts.pop();
                }
            }
            return (baseDirParts.length ? baseDirParts.join('/') + '/' : '') + relParts[2];
        }

        function makeRequireFunction(moduleObj, basePath) {
            return function require(moduleName) {
                var fileName = resolveRelativePath(moduleName, basePath);
                if (fileName === null) {
                    return mw.loader.require(moduleName);
                }
                if (hasOwn.call(
                        moduleObj.packageExports, fileName)) {
                    return moduleObj.packageExports[fileName];
                }
                var scriptFiles = moduleObj.script.files;
                if (!hasOwn.call(scriptFiles, fileName)) {
                    throw new Error('Cannot require undefined file ' + fileName);
                }
                var result, fileContent = scriptFiles[fileName];
                if (typeof fileContent === 'function') {
                    var moduleParam = {
                        exports: {}
                    };
                    fileContent(makeRequireFunction(moduleObj, fileName), moduleParam, moduleParam.exports);
                    result = moduleParam.exports;
                } else {
                    result = fileContent;
                }
                moduleObj.packageExports[fileName] = result;
                return result;
            };
        }

        function addScript(src, callback) {
            var script = document.createElement('script');
            script.src = src;
            script.onload = script.onerror = function() {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                if (callback) {
                    callback();
                    callback = null;
                }
            };
            document.head.appendChild(script);
        }

        function queueModuleScript(src, moduleName, callback) {
            pendingRequests.push(function() {
                if (moduleName !== 'jquery') {
                    window.require = mw.loader.require;
                    window.module = registry[moduleName].module;
                }
                addScript(src,
                    function() {
                        delete window.module;
                        callback();
                        if (pendingRequests[0]) {
                            pendingRequests.shift()();
                        } else {
                            handlingPendingRequests = false;
                        }
                    });
            });
            if (!handlingPendingRequests && pendingRequests[0]) {
                handlingPendingRequests = true;
                pendingRequests.shift()();
            }
        }

        function addLink(url, media, nextNode) {
            var el = document.createElement('link');
            el.rel = 'stylesheet';
            if (media) {
                el.media = media;
            }
            el.href = url;
            if (nextNode && nextNode.parentNode) {
                nextNode.parentNode.insertBefore(el, nextNode);
            } else {
                document.head.appendChild(el);
            }
        }

        function domEval(code) {
            var script = document.createElement('script');
            if (mw.config.get('wgCSPNonce') !== false) {
                script.nonce = mw.config.get('wgCSPNonce');
            }
            script.text = code;
            document.head.appendChild(script);
            script.parentNode.removeChild(script);
        }

        function enqueue(dependencies, ready, error) {
            if (allReady(dependencies)) {
                if (ready) {
                    ready();
                }
                return;
            }
            var failed = anyFailed(dependencies);
            if (failed !== false) {
                if (error) {
                    error(new Error('Dependency ' + failed + ' failed to load'), dependencies);
                }
                return;
            }
            if (ready || error) {
                jobs.push({
                    dependencies: dependencies.filter(function(module) {
                        var state = registry[module].state;
                        return state === 'registered' || state === 'loaded' || state === 'loading' || state === 'executing';
                    }),
                    ready: ready,
                    error: error
                });
            }
            dependencies.forEach(function(module) {
                if (registry[module].state === 'registered' && queue.indexOf(module) === -1) {
                    queue.push(module);
                }
            });
            mw.loader.work();
        }

        function execute(module) {
            if (registry[module].state !== 'loaded') {
                throw new Error('Module in state "' + registry[module].state + '" may not execute: ' + module);
            }
            registry[module].state = 'executing';
            var runScript = function() {
                var script = registry[module].script;
                var markModuleReady = function() {
                    setAndPropagate(module, 'ready');
                };
                var nestedAddScript = function(arr, offset) {
                    if (offset >= arr.length) {
                        markModuleReady();
                        return;
                    }
                    queueModuleScript(arr[offset], module, function() {
                        nestedAddScript(arr, offset + 1);
                    });
                };
                try {
                    if (Array.isArray(script)) {
                        nestedAddScript(script, 0);
                    } else if (typeof script === 'function') {
                        if (module === 'jquery') {
                            script();
                        } else {
                            script(window.$, window.$, mw.loader.require, registry[module].module);
                        }
                        markModuleReady();
                    } else if (typeof script === 'object' && script !== null) {
                        var mainScript = script.files[script.main];
                        if (typeof mainScript !== 'function') {
                            throw new Error('Main file in module ' + module + ' must be a function');
                        }
                        mainScript(makeRequireFunction(registry[module], script.main), registry[module].module, registry[module].module.exports);
                        markModuleReady();
                    } else if (typeof script === 'string') {
                        domEval(script);
                        markModuleReady();
                    } else {
                        markModuleReady();
                    }
                } catch (e) {
                    setAndPropagate(module, 'error');
                    mw.trackError('resourceloader.exception', {
                        exception: e,
                        module: module,
                        source: 'module-execute'
                    });
                }
            };
            if (registry[module].messages) {
                mw.messages.set(registry[module].messages);
            }
            if (registry[module].templates) {
                mw.templates.set(module, registry[module].templates);
            }
            var cssPending = 0;
            var cssHandle = function() {
                cssPending++;
                return function() {
                    cssPending--;
                    if (cssPending === 0) {
                        var runScriptCopy = runScript;
                        runScript = undefined;
                        runScriptCopy();
                    }
                };
            };
            if (registry[module].style) {
                for (var key in registry[
                        module].style) {
                    var value = registry[module].style[key];
                    if (key === 'css') {
                        for (var i = 0; i < value.length; i++) {
                            addEmbeddedCSS(value[i], cssHandle());
                        }
                    } else if (key === 'url') {
                        for (var media in value) {
                            var urls = value[media];
                            for (var j = 0; j < urls.length; j++) {
                                addLink(urls[j], media, marker);
                            }
                        }
                    }
                }
            }
            if (module === 'user') {
                var siteDeps;
                var siteDepErr;
                try {
                    siteDeps = resolve(['site']);
                } catch (e) {
                    siteDepErr = e;
                    runScript();
                }
                if (!siteDepErr) {
                    enqueue(siteDeps, runScript, runScript);
                }
            } else if (cssPending === 0) {
                runScript();
            }
        }

        function sortQuery(o) {
            var sorted = {};
            var list = [];
            for (var key in o) {
                list.push(key);
            }
            list.sort();
            for (var i = 0; i < list.length; i++) {
                sorted[list[i]] = o[list[i]];
            }
            return sorted;
        }

        function buildModulesString(moduleMap) {
            var str = [];
            var list = [];
            var p;

            function restore(suffix) {
                return p + suffix;
            }
            for (var prefix in moduleMap) {
                p = prefix === '' ? '' : prefix + '.';
                str.push(p + moduleMap[prefix].join(','));
                list.push.apply(list, moduleMap[prefix].map(restore));
            }
            return {
                str: str.join('|'),
                list: list
            };
        }

        function makeQueryString(params) {
            var chunks = [];
            for (
                var key in params) {
                chunks.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
            }
            return chunks.join('&');
        }

        function batchRequest(batch) {
            if (!batch.length) {
                return;
            }
            var sourceLoadScript, currReqBase, moduleMap;

            function doRequest() {
                var query = Object.create(currReqBase),
                    packed = buildModulesString(moduleMap);
                query.modules = packed.str;
                query.version = getCombinedVersion(packed.list);
                query = sortQuery(query);
                addScript(sourceLoadScript + '?' + makeQueryString(query));
            }
            batch.sort();
            var reqBase = {
                "lang": "pt",
                "skin": "vector-2022"
            };
            var splits = Object.create(null);
            for (var b = 0; b < batch.length; b++) {
                var bSource = registry[batch[b]].source;
                var bGroup = registry[batch[b]].group;
                if (!splits[bSource]) {
                    splits[bSource] = Object.create(null);
                }
                if (!splits[bSource][bGroup]) {
                    splits[bSource][bGroup] = [];
                }
                splits[bSource][bGroup].push(batch[b]);
            }
            for (var source in splits) {
                sourceLoadScript = sources[source];
                for (var group in splits[source]) {
                    var modules = splits[source][group];
                    currReqBase = Object.create(reqBase);
                    if (group === 0 && mw.config.get('wgUserName') !== null) {
                        currReqBase.user = mw.config.get('wgUserName');
                    }
                    var currReqBaseLength = makeQueryString(currReqBase).length + 23;
                    var length = currReqBaseLength;
                    var currReqModules = [];
                    moduleMap = Object.create(null);
                    for (var i = 0; i < modules.length; i++) {
                        var lastDotIndex = modules[i].lastIndexOf('.'),
                            prefix = modules[i].slice(0, Math.max(0, lastDotIndex)),
                            suffix = modules[i].slice(lastDotIndex + 1),
                            bytesAdded = moduleMap[prefix] ? suffix.length + 3 : modules[i].length + 3;
                        if (currReqModules.length && length + bytesAdded > mw.loader.maxQueryLength) {
                            doRequest();
                            length = currReqBaseLength;
                            moduleMap = Object.create(null);
                            currReqModules = [];
                        }
                        if (!moduleMap[prefix]) {
                            moduleMap[prefix] = [];
                        }
                        length += bytesAdded;
                        moduleMap[prefix].push(suffix);
                        currReqModules.push(modules[i]);
                    }
                    if (currReqModules.length) {
                        doRequest();
                    }
                }
            }
        }

        function asyncEval(implementations, cb) {
            if (!implementations.length) {
                return;
            }
            mw.requestIdleCallback(function() {
                try {
                    domEval(implementations.join(';'));
                } catch (err) {
                    cb(err);
                }
            });
        }

        function getModuleKey(module) {
            return module in
                registry ? (module + '@' + registry[module].version) : null;
        }

        function splitModuleKey(key) {
            var index = key.lastIndexOf('@');
            if (index === -1 || index === 0) {
                return {
                    name: key,
                    version: ''
                };
            }
            return {
                name: key.slice(0, index),
                version: key.slice(index + 1)
            };
        }

        function registerOne(module, version, dependencies, group, source, skip) {
            if (module in registry) {
                throw new Error('module already registered: ' + module);
            }
            version = String(version || '');
            if (version.slice(-1) === '!') {
                if (!isES6Supported) {
                    return;
                }
                version = version.slice(0, -1);
            }
            registry[module] = {
                module: {
                    exports: {}
                },
                packageExports: {},
                version: version,
                dependencies: dependencies || [],
                group: typeof group === 'undefined' ? null : group,
                source: typeof source === 'string' ? source : 'local',
                state: 'registered',
                skip: typeof skip === 'string' ? skip : null
            };
        }
        mw.loader = {
            moduleRegistry: registry,
            maxQueryLength: 5000,
            addStyleTag: newStyleTag,
            enqueue: enqueue,
            resolve: resolve,
            work: function() {
                store.init();
                var q = queue.length,
                    storedImplementations = [],
                    storedNames = [],
                    requestNames = [],
                    batch = new StringSet();
                while (q--) {
                    var module =
                        queue[q];
                    if (mw.loader.getState(module) === 'registered' && !batch.has(module)) {
                        registry[module].state = 'loading';
                        batch.add(module);
                        var implementation = store.get(module);
                        if (implementation) {
                            storedImplementations.push(implementation);
                            storedNames.push(module);
                        } else {
                            requestNames.push(module);
                        }
                    }
                }
                queue = [];
                asyncEval(storedImplementations, function(err) {
                    store.stats.failed++;
                    store.clear();
                    mw.trackError('resourceloader.exception', {
                        exception: err,
                        source: 'store-eval'
                    });
                    var failed = storedNames.filter(function(name) {
                        return registry[name].state === 'loading';
                    });
                    batchRequest(failed);
                });
                batchRequest(requestNames);
            },
            addSource: function(ids) {
                for (var id in ids) {
                    if (id in sources) {
                        throw new Error('source already registered: ' + id);
                    }
                    sources[id] = ids[id];
                }
            },
            register: function(modules) {
                if (typeof modules !== 'object') {
                    registerOne.apply(null, arguments);
                    return;
                }

                function resolveIndex(dep) {
                    return typeof dep === 'number' ? modules[dep][0] : dep;
                }
                for (var i = 0; i < modules.length; i++) {
                    var deps = modules[i][2];
                    if (deps) {
                        for (var j = 0; j < deps.length; j++) {
                            deps[j] = resolveIndex(deps[j]);
                        }
                    }
                    registerOne.apply(null, modules[i]);
                }
            },
            implement: function(module, script, style, messages, templates) {
                var split = splitModuleKey(module),
                    name = split.name,
                    version = split.version;
                if (!(name in registry)) {
                    mw.loader.register(name);
                }
                if (registry[name].script !== undefined) {
                    throw new Error('module already implemented: ' + name);
                }
                if (version) {
                    registry[name].version = version;
                }
                registry[name].script = script || null;
                registry[name].style = style || null;
                registry[name].messages = messages || null;
                registry[name].templates = templates || null;
                if (registry[name].state !== 'error' && registry[name].state !== 'missing') {
                    setAndPropagate(name, 'loaded');
                }
            },
            load: function(modules, type) {
                if (typeof modules === 'string' && /^(https?:)?\/?\//.test(modules)) {
                    if (type === 'text/css') {
                        addLink(modules);
                    } else if (type === 'text/javascript' || type === undefined) {
                        addScript(modules);
                    } else {
                        throw new Error('Invalid type ' + type);
                    }
                } else {
                    modules = typeof modules === 'string' ? [modules] : modules;
                    enqueue(resolveStubbornly(modules));
                }
            },
            state: function(
                states) {
                for (var module in states) {
                    if (!(module in registry)) {
                        mw.loader.register(module);
                    }
                    setAndPropagate(module, states[module]);
                }
            },
            getState: function(module) {
                return module in registry ? registry[module].state : null;
            },
            require: function(moduleName) {
                if (mw.loader.getState(moduleName) !== 'ready') {
                    throw new Error('Module "' + moduleName + '" is not loaded');
                }
                return registry[moduleName].module.exports;
            }
        };
        var hasPendingWrites = false;

        function flushWrites() {
            store.prune();
            while (store.queue.length) {
                store.set(store.queue.shift());
            }
            try {
                localStorage.removeItem(store.key);
                var data = JSON.stringify(store);
                localStorage.setItem(store.key, data);
            } catch (e) {
                mw.trackError('resourceloader.exception', {
                    exception: e,
                    source: 'store-localstorage-update'
                });
            }
            hasPendingWrites = false;
        }
        mw.loader.store = store = {
            enabled: null,
            items: {},
            queue: [],
            stats: {
                hits: 0,
                misses: 0,
                expired: 0,
                failed: 0
            },
            toJSON: function() {
                return {
                    items: store.items,
                    vary: store.vary,
                    asOf: Math.ceil(Date.now() / 1e7)
                };
            },
            key: "MediaWikiModuleStore:ptwiki",
            vary: "vector-2022:1-3:pt",
            init: function() {
                if (this.enabled === null) {
                    this.enabled = false;
                    if (true) {
                        this.load();
                    } else {
                        this.clear();
                    }
                }
            },
            load: function() {
                try {
                    var raw = localStorage.getItem(this.key);
                    this.enabled = true;
                    var data = JSON.parse(raw);
                    if (data && data.vary === this.vary && data.items && Date.now() < (data.asOf * 1e7) + 259e7) {
                        this.items = data.items;
                    }
                } catch (e) {}
            },
            get: function(module) {
                if (this.enabled) {
                    var key = getModuleKey(module);
                    if (key in this.items) {
                        this.stats.hits++;
                        return this.items[key];
                    }
                    this.stats.misses++;
                }
                return false;
            },
            add: function(module) {
                if (this.enabled) {
                    this.queue.push(module);
                    this.requestUpdate();
                }
            },
            set: function(module) {
                var args, encodedScript, descriptor = registry[module],
                    key = getModuleKey(module);
                if (key in this.items || !descriptor || descriptor.state !== 'ready' || !descriptor.version || descriptor.group === 1 || descriptor.group === 0 || [descriptor.script, descriptor.style, descriptor.messages, descriptor.templates].indexOf(undefined) !== -1) {
                    return;
                }
                try {
                    if (typeof descriptor.script === 'function') {
                        encodedScript = String(descriptor.script);
                    } else if (
                        typeof descriptor.script === 'object' && descriptor.script && !Array.isArray(descriptor.script)) {
                        encodedScript = '{' + 'main:' + JSON.stringify(descriptor.script.main) + ',' + 'files:{' + Object.keys(descriptor.script.files).map(function(file) {
                            var value = descriptor.script.files[file];
                            return JSON.stringify(file) + ':' + (typeof value === 'function' ? value : JSON.stringify(value));
                        }).join(',') + '}}';
                    } else {
                        encodedScript = JSON.stringify(descriptor.script);
                    }
                    args = [JSON.stringify(key), encodedScript, JSON.stringify(descriptor.style), JSON.stringify(descriptor.messages), JSON.stringify(descriptor.templates)];
                } catch (e) {
                    mw.trackError('resourceloader.exception', {
                        exception: e,
                        source: 'store-localstorage-json'
                    });
                    return;
                }
                var src = 'mw.loader.implement(' + args.join(',') + ');';
                if (src.length > 1e5) {
                    return;
                }
                this.items[key] = src;
            },
            prune: function() {
                for (var key in this.items) {
                    if (getModuleKey(splitModuleKey(key).name) !== key) {
                        this.stats.expired++;
                        delete this.items[key];
                    }
                }
            },
            clear: function() {
                this.items = {};
                try {
                    localStorage.removeItem(this.key);
                } catch (e) {}
            },
            requestUpdate: function() {
                if (!hasPendingWrites) {
                    hasPendingWrites = true;
                    setTimeout(function() {
                        mw.requestIdleCallback(flushWrites);
                    }, 2000);
                }
            }
        };
    }());
    mw.requestIdleCallbackInternal = function(callback) {
        setTimeout(function() {
            var start = mw.now();
            callback({
                didTimeout: false,
                timeRemaining: function() {
                    return Math.max(0, 50 - (mw.now() - start));
                }
            });
        }, 1);
    };
    mw.requestIdleCallback = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : mw.requestIdleCallbackInternal;
    (function() {
        var queue;
        mw.loader.addSource({
            "local": "/w/load.php",
            "metawiki": "//meta.wikimedia.org/w/load.php"
        });
        mw.loader.register([
            ["site", "1ws0w", [1]],
            ["site.styles", "1jbcj", [], 2],
            ["filepage", "g5bm6"],
            ["user", "s1wiu", [], 0],
            ["user.styles", "smrj4", [], 0],
            ["user.options", "1i9g4", [], 1],
            ["mediawiki.skinning.elements", "oaj7f"],
            ["mediawiki.skinning.content", "rnvp4"],
            ["mediawiki.skinning.interface", "67k8b"],
            ["jquery.makeCollapsible.styles", "603sp"],
            ["mediawiki.skinning.content.parsoid", "1uqe5"],
            ["mediawiki.skinning.content.externallinks",
                "baffc"
            ],
            ["jquery", "1vnvf"],
            ["es6-polyfills", "u287e", [], null, null, "return Array.prototype.find\u0026\u0026Array.prototype.findIndex\u0026\u0026Array.prototype.includes\u0026\u0026typeof Promise==='function'\u0026\u0026Promise.prototype.finally;"],
            ["web2017-polyfills", "giosa", [13], null, null, "return'IntersectionObserver'in window\u0026\u0026typeof fetch==='function'\u0026\u0026typeof URL==='function'\u0026\u0026'toJSON'in URL.prototype;"],
            ["mediawiki.base", "1s7nc", [12]],
            ["jquery.chosen", "1gytp"],
            ["jquery.client", "1tje2"],
            ["jquery.color", "qs4nu"],
            ["jquery.confirmable", "1cgqy", [113]],
            ["jquery.cookie", "1u41n"],
            ["jquery.form", "186tg"],
            ["jquery.fullscreen", "18ttp"],
            ["jquery.highlightText", "t130m", [87]],
            ["jquery.hoverIntent", "pqqa9"],
            ["jquery.i18n", "31t4a", [112]],
            ["jquery.lengthLimit", "qrnp1", [69]],
            ["jquery.makeCollapsible", "jpfma", [9]],
            ["jquery.spinner", "yoa8f", [29]],
            ["jquery.spinner.styles", "pfek7"],
            ["jquery.suggestions", "1ykxl", [23]],
            ["jquery.tablesorter", "z2fys", [32, 114, 87]],
            [
                "jquery.tablesorter.styles", "1ceqa"
            ],
            ["jquery.textSelection", "em3yw", [17]],
            ["jquery.throttle-debounce", "1bymo"],
            ["jquery.tipsy", "75pn7"],
            ["jquery.ui", "8rg4v"],
            ["moment", "1m1ae", [110, 87]],
            ["vue", "iiejt!"],
            ["@vue/composition-api", "1s4l3", [38]],
            ["vuex", "ironm!", [38]],
            ["wvui", "46zus", [39]],
            ["wvui-search", "1rr2l", [38]],
            ["@wikimedia/codex", "tgswr!", [38]],
            ["mediawiki.template", "6nkqm"],
            ["mediawiki.template.mustache", "gy30q", [44]],
            ["mediawiki.apipretty", "5bju3"],
            ["mediawiki.api", "18t5g", [75, 113]],
            ["mediawiki.content.json", "ic2d2"],
            ["mediawiki.confirmCloseWindow", "17vva"],
            ["mediawiki.debug", "a5lwb", [200]],
            ["mediawiki.diff", "oztjs"],
            ["mediawiki.diff.styles", "1jzsw"],
            ["mediawiki.feedback", "14886", [873, 208]],
            ["mediawiki.feedlink", "5bck4"],
            ["mediawiki.filewarning", "gzqvi", [200, 212]],
            ["mediawiki.ForeignApi", "17f2l", [316]],
            ["mediawiki.ForeignApi.core", "15s0r", [84, 47, 196]],
            ["mediawiki.helplink", "5fs9z"],
            ["mediawiki.hlist", "1ikwi"],
            ["mediawiki.htmlform", "1suuj", [26, 87]],
            ["mediawiki.htmlform.ooui",
                "moc8u", [200]
            ],
            ["mediawiki.htmlform.styles", "1go16"],
            ["mediawiki.htmlform.ooui.styles", "1ovh0"],
            ["mediawiki.icon", "17xlm"],
            ["mediawiki.inspect", "1w7zb", [69, 87]],
            ["mediawiki.notification", "xatij", [87, 93]],
            ["mediawiki.notification.convertmessagebox", "zb0xo", [66]],
            ["mediawiki.notification.convertmessagebox.styles", "dro1f"],
            ["mediawiki.String", "1ck84"],
            ["mediawiki.pager.styles", "9uw59"],
            ["mediawiki.pager.tablePager", "ykcx2"],
            ["mediawiki.pulsatingdot", "svyap"],
            ["mediawiki.searchSuggest", "1fx1r", [30, 47]],
            ["mediawiki.storage", "1sj4u"],
            ["mediawiki.Title", "1jojn", [69, 87]],
            ["mediawiki.Upload", "3i9e4", [47]],
            ["mediawiki.ForeignUpload", "1ykwd", [56, 76]],
            ["mediawiki.ForeignStructuredUpload", "961rn", [77]],
            ["mediawiki.Upload.Dialog", "1drdu", [80]],
            ["mediawiki.Upload.BookletLayout", "1f9js", [76, 85, 37, 203, 208, 213, 214]],
            ["mediawiki.ForeignStructuredUpload.BookletLayout", "1qf27", [78, 80, 117, 179, 173]],
            ["mediawiki.toc", "5oex3", [90]],
            ["mediawiki.toc.styles", "1ay1u"],
            ["mediawiki.Uri", "1n2iu", [87]],
            [
                "mediawiki.user", "1ab6a", [47, 90]
            ],
            ["mediawiki.userSuggest", "1tzu5", [30, 47]],
            ["mediawiki.util", "1cldo", [17]],
            ["mediawiki.checkboxtoggle", "nzeg7"],
            ["mediawiki.checkboxtoggle.styles", "1esmp"],
            ["mediawiki.cookie", "l9tfk", [20]],
            ["mediawiki.experiments", "8e8ao"],
            ["mediawiki.editfont.styles", "76g2r"],
            ["mediawiki.visibleTimeout", "1bmk6"],
            ["mediawiki.action.delete", "zjbix", [26, 200]],
            ["mediawiki.action.edit", "1i3ou", [33, 96, 47, 92, 175]],
            ["mediawiki.action.edit.styles", "w6lp4"],
            ["mediawiki.action.edit.collapsibleFooter", "1jlz7", [27, 64, 74]],
            ["mediawiki.action.edit.preview", "11yor", [28, 123, 85]],
            ["mediawiki.action.history", "1j8pz", [27]],
            ["mediawiki.action.history.styles", "10vu6"],
            ["mediawiki.action.protect", "143pm", [26, 200]],
            ["mediawiki.action.view.metadata", "a4472", [108]],
            ["mediawiki.action.view.categoryPage.styles", "17h5y"],
            ["mediawiki.action.view.postEdit", "dwgxi", [113, 66, 200, 219]],
            ["mediawiki.action.view.redirect", "1a3n8", [17]],
            ["mediawiki.action.view.redirectPage", "1jh9v"],
            [
                "mediawiki.action.edit.editWarning", "192id", [33, 49, 113]
            ],
            ["mediawiki.action.view.filepage", "ek78u"],
            ["mediawiki.action.styles", "xz1f2"],
            ["mediawiki.language", "1yvb8", [111]],
            ["mediawiki.cldr", "1630p", [112]],
            ["mediawiki.libs.pluralruleparser", "8vy0u"],
            ["mediawiki.jqueryMsg", "lrjj8", [69, 110, 87, 5]],
            ["mediawiki.language.months", "159r5", [110]],
            ["mediawiki.language.names", "5f1tq", [110]],
            ["mediawiki.language.specialCharacters", "qxu6c", [110]],
            ["mediawiki.libs.jpegmeta", "16fc5"],
            ["mediawiki.page.gallery", "a58cf", [119, 87]],
            ["mediawiki.page.gallery.styles", "1p8qp"],
            ["mediawiki.page.gallery.slideshow", "2w7ke", [47, 203, 222, 224]],
            ["mediawiki.page.ready", "f6fdj", [47]],
            ["mediawiki.page.watch.ajax", "1oqie", [47]],
            ["mediawiki.page.preview", "1ep4p", [27, 33, 47, 52, 200]],
            ["mediawiki.page.image.pagination", "18sxf", [28, 87]],
            ["mediawiki.rcfilters.filters.base.styles", "17zp2"],
            ["mediawiki.rcfilters.highlightCircles.seenunseen.styles", "1726s"],
            ["mediawiki.rcfilters.filters.ui", "7ngll", [27, 84, 85, 170, 209, 216, 218, 219,
                220, 222, 223
            ]],
            ["mediawiki.interface.helpers.styles", "1gbsm"],
            ["mediawiki.special", "10u1g"],
            ["mediawiki.special.apisandbox", "1ko6u", [27, 84, 190, 176, 199, 214]],
            ["mediawiki.special.block", "3z6jo", [60, 173, 189, 180, 190, 187, 214, 216]],
            ["mediawiki.misc-authed-ooui", "4897z", [61, 170, 175]],
            ["mediawiki.misc-authed-pref", "1b18i", [5]],
            ["mediawiki.misc-authed-curate", "1rbsw", [19, 28, 47]],
            ["mediawiki.special.changeslist", "v14k4"],
            ["mediawiki.special.changeslist.watchlistexpiry", "13j3d", [129]],
            ["mediawiki.special.changeslist.enhanced", "1xll3"],
            ["mediawiki.special.changeslist.legend", "1oetg"],
            ["mediawiki.special.changeslist.legend.js", "fa4m4", [27, 90]],
            ["mediawiki.special.contributions", "ua2dg", [27, 113, 173, 199]],
            ["mediawiki.special.edittags", "yihzm", [16, 26]],
            ["mediawiki.special.import", "5dvpi", [170]],
            ["mediawiki.special.import.styles.ooui", "mg0a0"],
            ["mediawiki.special.preferences.ooui", "eq2u4", [49, 92, 67, 74, 180, 175]],
            ["mediawiki.special.preferences.styles.ooui", "ad322"],
            ["mediawiki.special.revisionDelete",
                "e8jxp", [26]
            ],
            ["mediawiki.special.search", "1sevh", [192]],
            ["mediawiki.special.search.commonsInterwikiWidget", "1jnav", [84, 47]],
            ["mediawiki.special.search.interwikiwidget.styles", "3t5cb"],
            ["mediawiki.special.search.styles", "10xhp"],
            ["mediawiki.special.unwatchedPages", "1cjky", [47]],
            ["mediawiki.special.upload", "1pegy", [28, 47, 49, 117, 129, 44]],
            ["mediawiki.special.userlogin.common.styles", "b44v9"],
            ["mediawiki.special.userlogin.login.styles", "1bqrv"],
            ["mediawiki.special.createaccount", "7yj22", [47]],
            ["mediawiki.special.userlogin.signup.styles", "io5o1"],
            ["mediawiki.special.userrights", "faiav", [26, 67]],
            ["mediawiki.special.watchlist", "li60u", [47, 200, 219]],
            ["mediawiki.special.version", "5yx4s"],
            ["mediawiki.legacy.config", "uooyq"],
            ["mediawiki.legacy.commonPrint", "1hzmi"],
            ["mediawiki.legacy.shared", "1w95x"],
            ["mediawiki.ui", "1sqp0"],
            ["mediawiki.ui.checkbox", "iizlc"],
            ["mediawiki.ui.radio", "zgovq"],
            ["mediawiki.ui.anchor", "yn5im"],
            ["mediawiki.ui.button", "138cu"],
            ["mediawiki.ui.input", "nkrkk"],
            [
                "mediawiki.ui.icon", "tzge2"
            ],
            ["mediawiki.widgets", "vnf9c", [47, 171, 203, 213]],
            ["mediawiki.widgets.styles", "1kqtv"],
            ["mediawiki.widgets.AbandonEditDialog", "1yk5f", [208]],
            ["mediawiki.widgets.DateInputWidget", "ml30e", [174, 37, 203, 224]],
            ["mediawiki.widgets.DateInputWidget.styles", "rbfsm"],
            ["mediawiki.widgets.visibleLengthLimit", "uj2nl", [26, 200]],
            ["mediawiki.widgets.datetime", "1odg9", [87, 200, 219, 223, 224]],
            ["mediawiki.widgets.expiry", "1xp7z", [176, 37, 203]],
            ["mediawiki.widgets.CheckMatrixWidget", "bbszi", [200]],
            ["mediawiki.widgets.CategoryMultiselectWidget", "nn6wj", [56, 203]],
            ["mediawiki.widgets.SelectWithInputWidget", "yjlkr", [181, 203]],
            ["mediawiki.widgets.SelectWithInputWidget.styles", "4wtw6"],
            ["mediawiki.widgets.SizeFilterWidget", "rt2t2", [183, 203]],
            ["mediawiki.widgets.SizeFilterWidget.styles", "b3yqn"],
            ["mediawiki.widgets.MediaSearch", "mbu0z", [56, 85, 203]],
            ["mediawiki.widgets.Table", "gw83d", [203]],
            ["mediawiki.widgets.TagMultiselectWidget", "1mwuq", [203]],
            ["mediawiki.widgets.UserInputWidget", "1555z",
                [47, 203]
            ],
            ["mediawiki.widgets.UsersMultiselectWidget", "1h6xp", [47, 203]],
            ["mediawiki.widgets.NamespacesMultiselectWidget", "jiviu", [203]],
            ["mediawiki.widgets.TitlesMultiselectWidget", "593ki", [170]],
            ["mediawiki.widgets.TagMultiselectWidget.styles", "1hdc9"],
            ["mediawiki.widgets.SearchInputWidget", "haq07", [73, 170, 219]],
            ["mediawiki.widgets.SearchInputWidget.styles", "176ja"],
            ["mediawiki.watchstar.widgets", "1xq28", [199]],
            ["mediawiki.deflate", "glf6m"],
            ["oojs", "1ch6v"],
            ["mediawiki.router", "ajk4o", [198]],
            ["oojs-router", "3j2x4", [196]],
            ["oojs-ui", "1gvrd", [206, 203, 208]],
            ["oojs-ui-core", "13pek", [110, 196, 202, 201, 210]],
            ["oojs-ui-core.styles", "2bh26"],
            ["oojs-ui-core.icons", "q2ynj"],
            ["oojs-ui-widgets", "12nm9", [200, 205]],
            ["oojs-ui-widgets.styles", "15b57"],
            ["oojs-ui-widgets.icons", "14deu"],
            ["oojs-ui-toolbars", "drs9w", [200, 207]],
            ["oojs-ui-toolbars.icons", "1cwpf"],
            ["oojs-ui-windows", "k36qt", [200, 209]],
            ["oojs-ui-windows.icons", "1sggt"],
            ["oojs-ui.styles.indicators", "hg2jp"],
            ["oojs-ui.styles.icons-accessibility", "1820h"],
            ["oojs-ui.styles.icons-alerts", "1hptv"],
            ["oojs-ui.styles.icons-content", "1r53a"],
            ["oojs-ui.styles.icons-editing-advanced", "1vv05"],
            ["oojs-ui.styles.icons-editing-citation", "1b7i5"],
            ["oojs-ui.styles.icons-editing-core", "392jc"],
            ["oojs-ui.styles.icons-editing-list", "6tdu5"],
            ["oojs-ui.styles.icons-editing-styling", "82u8v"],
            ["oojs-ui.styles.icons-interactions", "1b4cq"],
            ["oojs-ui.styles.icons-layout", "svw5m"],
            ["oojs-ui.styles.icons-location", "1i9ks"],
            ["oojs-ui.styles.icons-media", "751c1"],
            ["oojs-ui.styles.icons-moderation", "s5kwz"],
            ["oojs-ui.styles.icons-movement", "1p0oe"],
            ["oojs-ui.styles.icons-user", "15161"],
            ["oojs-ui.styles.icons-wikimedia", "qul0g"],
            ["skins.vector.user", "1xvcb", [], 0],
            ["skins.vector.user.styles", "1gxes", [], 0],
            ["skins.vector.search", "16kom!", [84, 42]],
            ["skins.vector.styles.legacy", "1crc4"],
            ["skins.vector.styles", "1k132"],
            ["skins.vector.icons.js", "svj0i"],
            ["skins.vector.icons", "1b4vk"],
            ["skins.vector.es6", "1jvog!", [91, 121, 122, 85, 232]],
            ["skins.vector.js", "m7l8m", [
                121, 232
            ]],
            ["skins.vector.legacy.js", "1re3s", [121]],
            ["skins.monobook.styles", "obci7"],
            ["skins.monobook.scripts", "1qxi2", [85, 212]],
            ["skins.modern", "1y15y"],
            ["skins.cologneblue", "wj1d2"],
            ["skins.timeless", "cshql"],
            ["skins.timeless.js", "poasm"],
            ["ext.timeline.styles", "poumc"],
            ["ext.wikihiero", "129wi"],
            ["ext.wikihiero.special", "17wtq", [244, 28, 200]],
            ["ext.wikihiero.visualEditor", "1xcxi", [435]],
            ["ext.charinsert", "4sxcx", [33]],
            ["ext.charinsert.styles", "ou48j"],
            ["ext.cite.styles", "1lb4h"],
            ["ext.cite.style", "yx4l1"],
            ["ext.cite.visualEditor.core", "1igy0", [443]],
            ["ext.cite.visualEditor", "itb3b", [250, 249, 251, 212, 215, 219]],
            ["ext.cite.ux-enhancements", "1mty7"],
            ["ext.citeThisPage", "1rb6k"],
            ["ext.inputBox.styles", "15tb6"],
            ["ext.pygments", "1u9pi"],
            ["ext.pygments.linenumbers", "zyy6j"],
            ["ext.geshi.visualEditor", "zwlpr", [435]],
            ["ext.categoryTree", "v8lrh", [47]],
            ["ext.categoryTree.styles", "1ho9u"],
            ["ext.spamBlacklist.visualEditor", "ovffn"],
            ["mediawiki.api.titleblacklist", "6nhct", [47]],
            [
                "ext.titleblacklist.visualEditor", "1taqb"
            ],
            ["mw.PopUpMediaTransform", "340aa", [278, 75, 281]],
            ["mw.TMHGalleryHook.js", "11rpk"],
            ["ext.tmh.embedPlayerIframe", "1ybhf", [283, 281]],
            ["mw.MediaWikiPlayerSupport", "1p0go", [281]],
            ["mw.MediaWikiPlayer.loader", "scrqo", [283]],
            ["ext.tmh.video-js", "11i53"],
            ["ext.tmh.videojs-ogvjs", "1d5xe", [279, 269]],
            ["ext.tmh.player", "1judn", [278, 274, 75]],
            ["ext.tmh.player.dialog", "u5l2p", [273, 208]],
            ["ext.tmh.player.inline", "n8nun", [269, 75]],
            ["ext.tmh.player.styles", "18mke"],
            ["ext.tmh.thumbnail.styles", "hrhb9"],
            ["ext.tmh.transcodetable", "1qiix", [47, 199]],
            ["ext.tmh.timedtextpage.styles", "8t06n"],
            ["ext.tmh.OgvJsSupport", "hyg7n"],
            ["ext.tmh.OgvJs", "dee9x", [278]],
            ["embedPlayerIframeStyle", "2hl6r"],
            ["mw.MwEmbedSupport", "1eu23", [87]],
            ["mediawiki.UtilitiesTime", "sobvx"],
            ["jquery.embedPlayer", "3n73h"],
            ["mw.EmbedPlayer", "1vrb6", [278, 20, 24, 36, 84, 282, 113, 286, 281]],
            ["mw.EmbedPlayerKplayer", "9brbg"],
            ["mw.EmbedPlayerNative", "fkawj"],
            ["mw.EmbedPlayerVLCApp", "iihbe", [84]],
            [
                "mw.EmbedPlayerIEWebMPrompt", "k2n9t"
            ],
            ["mw.EmbedPlayerOgvJs", "183ok", [278, 28]],
            ["mw.EmbedPlayerImageOverlay", "1ihz4"],
            ["mw.TimedText", "k6eox", [115, 284]],
            ["ext.urlShortener.special", "ocdn6", [84, 61, 170, 199]],
            ["ext.urlShortener.toolbar", "1593z", [47]],
            ["ext.securepoll.htmlform", "lci2x", [28, 187]],
            ["ext.securepoll", "7ece9"],
            ["ext.securepoll.special", "lvyc3"],
            ["ext.score.visualEditor", "espht", [298, 435]],
            ["ext.score.visualEditor.icons", "12g54"],
            ["ext.score.popup", "tvdem", [47]],
            ["ext.score.errors", "s56a4"],
            ["ext.cirrus.serp", "6fxwx", [84, 197]],
            ["ext.cirrus.explore-similar", "1vh6h", [47, 45]],
            ["ext.nuke.confirm", "gk8un", [113]],
            ["ext.confirmEdit.editPreview.ipwhitelist.styles", "1hytm"],
            ["ext.confirmEdit.visualEditor", "dqe95", [862]],
            ["ext.confirmEdit.simpleCaptcha", "13qx3"],
            ["ext.confirmEdit.fancyCaptcha.styles", "1xhxt"],
            ["ext.confirmEdit.fancyCaptcha", "1dz3b", [47]],
            ["ext.confirmEdit.fancyCaptchaMobile", "1dz3b", [495]],
            ["ext.centralauth", "1gy04", [28, 87]],
            ["ext.centralauth.centralautologin", "3si48", [
                113
            ]],
            ["ext.centralauth.centralautologin.clearcookie", "1kb7x"],
            ["ext.centralauth.misc.styles", "157rq"],
            ["ext.centralauth.globaluserautocomplete", "1ik8f", [30, 47]],
            ["ext.centralauth.globalrenameuser", "1y1q2", [87]],
            ["ext.centralauth.ForeignApi", "1tkmh", [57]],
            ["ext.widgets.GlobalUserInputWidget", "tw2pv", [47, 203]],
            ["ext.GlobalUserPage", "ibfm1"],
            ["ext.apifeatureusage", "ohwd2"],
            ["ext.dismissableSiteNotice", "1tqui", [20, 87]],
            ["ext.dismissableSiteNotice.styles", "1psm7"],
            ["ext.centralNotice.startUp", "1ptwd", [324]],
            ["ext.centralNotice.geoIP", "spv2q", [20]],
            ["ext.centralNotice.choiceData", "9pqoc", [328]],
            ["ext.centralNotice.display", "up6v4", [323, 326, 602, 84, 74]],
            ["ext.centralNotice.kvStore", "yqh2i"],
            ["ext.centralNotice.bannerHistoryLogger", "qedmi", [325]],
            ["ext.centralNotice.impressionDiet", "n5zrg", [325]],
            ["ext.centralNotice.largeBannerLimit", "p2grr", [325]],
            ["ext.centralNotice.legacySupport", "1kh3o", [325]],
            ["ext.centralNotice.bannerSequence", "q58r6", [325]],
            ["ext.centralNotice.freegeoipLookup", "1ab6b", [
                323
            ]],
            ["ext.centralNotice.impressionEventsSampleRate", "1kg37", [325]],
            ["ext.centralNotice.cspViolationAlert", "1q70c"],
            ["ext.wikimediamessages.contactpage.affcomchapthorg", "1ukrj"],
            ["ext.wikimediamessages.contactpage.affcomusergroup", "168yb"],
            ["mediawiki.special.block.feedback.request", "yglzq"],
            ["ext.collection", "1l010", [340, 36, 110]],
            ["ext.collection.bookcreator.styles", "lbuv4"],
            ["ext.collection.bookcreator", "macvf", [339, 74, 87]],
            ["ext.collection.checkLoadFromLocalStorage", "4pi2w", [338]],
            ["ext.collection.suggest", "1wfr5", [340]],
            ["ext.collection.offline", "1bnwx"],
            ["ext.collection.bookcreator.messageBox", "1gvrd", [346, 345, 59]],
            ["ext.collection.bookcreator.messageBox.styles", "1gnkt"],
            ["ext.collection.bookcreator.messageBox.icons", "aesbw"],
            ["ext.ElectronPdfService.print.styles", "13dj6"],
            ["ext.ElectronPdfService.special.styles", "1q6mi"],
            ["ext.ElectronPdfService.special.selectionImages", "zvvcu"],
            ["ext.advancedSearch.initialstyles", "ek74w"],
            ["ext.advancedSearch.styles", "t0b5a"],
            [
                "ext.advancedSearch.searchtoken", "1vhat", [], 1
            ],
            ["ext.advancedSearch.elements", "1h9wn", [351, 84, 85, 203, 219, 220]],
            ["ext.advancedSearch.init", "1bdxa", [353, 352]],
            ["ext.advancedSearch.SearchFieldUI", "1g455", [75, 203]],
            ["ext.abuseFilter", "6lhiu"],
            ["ext.abuseFilter.edit", "zorc8", [28, 33, 47, 49, 203]],
            ["ext.abuseFilter.tools", "1v3jq", [28, 47]],
            ["ext.abuseFilter.examine", "p5twb", [28, 47]],
            ["ext.abuseFilter.ace", "67phm", [582]],
            ["ext.abuseFilter.visualEditor", "148wm"],
            ["pdfhandler.messages", "rrenw"],
            ["ext.wikiEditor", "w172j", [33, 36, 116, 85, 170, 214, 215, 216, 217, 218, 222, 44], 3],
            ["ext.wikiEditor.styles", "3kdjm", [], 3],
            ["ext.wikiEditor.images", "1x7tu"],
            ["ext.wikiEditor.realtimepreview", "rsxi1", [363, 365, 123, 219]],
            ["ext.CodeMirror", "15p7k", [368, 33, 36, 85, 218]],
            ["ext.CodeMirror.data", "19w0r"],
            ["ext.CodeMirror.lib", "12rli"],
            ["ext.CodeMirror.addons", "18r8x", [369]],
            ["ext.CodeMirror.mode.mediawiki", "19eyn", [369]],
            ["ext.CodeMirror.lib.mode.css", "12rkf", [369]],
            ["ext.CodeMirror.lib.mode.javascript", "kv1z9", [369]],
            [
                "ext.CodeMirror.lib.mode.xml", "1n718", [369]
            ],
            ["ext.CodeMirror.lib.mode.htmlmixed", "12m9d", [372, 373, 374]],
            ["ext.CodeMirror.lib.mode.clike", "1eahy", [369]],
            ["ext.CodeMirror.lib.mode.php", "19ek6", [376, 375]],
            ["ext.CodeMirror.visualEditor.init", "nk1c1"],
            ["ext.CodeMirror.visualEditor", "qvp7i", [435]],
            ["ext.MassMessage.styles", "yqa78"],
            ["ext.MassMessage.special.js", "4vcwx", [26, 34, 36, 113]],
            ["ext.MassMessage.content.js", "txdtv", [19, 36, 47]],
            ["ext.MassMessage.create", "1k3y2", [36, 61, 113]],
            ["ext.MassMessage.edit", "1k1lh", [175, 199]],
            ["ext.betaFeatures", "7boze", [17, 200]],
            ["ext.betaFeatures.styles", "1da2e"],
            ["mmv", "6p5kb", [18, 22, 35, 84, 392]],
            ["mmv.ui.ondemandshareddependencies", "12dp4", [387, 199]],
            ["mmv.ui.download.pane", "18750", [163, 170, 388]],
            ["mmv.ui.reuse.shareembed", "1mo82", [170, 388]],
            ["mmv.ui.tipsyDialog", "1vjiv", [387]],
            ["mmv.bootstrap", "1k52e", [167, 169, 394, 198]],
            ["mmv.bootstrap.autostart", "1bp9m", [392]],
            ["mmv.head", "f0dls", [74, 85]],
            ["ext.popups.icons", "1ho9j"],
            ["ext.popups.images", "w55o3"],
            [
                "ext.popups", "j5ccd"
            ],
            ["ext.popups.main", "v5mny", [395, 396, 84, 91, 74, 167, 164, 169, 85]],
            ["ext.linter.edit", "h2pbf", [33]],
            ["socket.io", "fcmug"],
            ["dompurify", "cw5fe"],
            ["color-picker", "1hxf4"],
            ["unicodejs", "alrva"],
            ["papaparse", "5tm70"],
            ["rangefix", "ekvqx"],
            ["spark-md5", "1uk2w"],
            ["ext.visualEditor.supportCheck", "hzrm9", [], 4],
            ["ext.visualEditor.sanitize", "1snr7", [401, 424], 4],
            ["ext.visualEditor.progressBarWidget", "1ns9r", [], 4],
            ["ext.visualEditor.tempWikitextEditorWidget", "479tx", [92, 85], 4],
            ["ext.visualEditor.desktopArticleTarget.init", "8stmx", [409, 407, 410, 421, 33, 84, 121, 74], 4],
            ["ext.visualEditor.desktopArticleTarget.noscript", "pwtga"],
            ["ext.visualEditor.targetLoader", "hjin2", [423, 421, 33, 84, 74, 85], 4],
            ["ext.visualEditor.desktopTarget", "5e38y", [], 4],
            ["ext.visualEditor.desktopArticleTarget", "lecn4", [427, 432, 414, 437], 4],
            ["ext.visualEditor.collabTarget", "f9y15", [425, 431, 92, 170, 219, 220], 4],
            ["ext.visualEditor.collabTarget.desktop", "1mdgr", [416, 432, 414, 437], 4],
            ["ext.visualEditor.collabTarget.init",
                "1sgot", [407, 170, 199], 4
            ],
            ["ext.visualEditor.collabTarget.init.styles", "18e9s"],
            ["ext.visualEditor.ve", "1mbx1", [], 4],
            ["ext.visualEditor.track", "1lfjv", [420], 4],
            ["ext.visualEditor.core.utils", "fkgtc", [421, 199], 4],
            ["ext.visualEditor.core.utils.parsing", "1584k", [420], 4],
            ["ext.visualEditor.base", "12nah", [422, 423, 403], 4],
            ["ext.visualEditor.mediawiki", "gorcq", [424, 413, 31, 629], 4],
            ["ext.visualEditor.mwsave", "lekh7", [435, 26, 28, 52, 219], 4],
            ["ext.visualEditor.articleTarget", "1i3bc", [436, 426, 172], 4],
            ["ext.visualEditor.data", "e02df", [425]],
            ["ext.visualEditor.core", "1kzzz", [408, 407, 17, 404, 405, 406], 4],
            ["ext.visualEditor.commentAnnotation", "e4r4z", [429], 4],
            ["ext.visualEditor.rebase", "ussts", [402, 446, 430, 225, 400], 4],
            ["ext.visualEditor.core.desktop", "ielvz", [429], 4],
            ["ext.visualEditor.welcome", "wkf1d", [199], 4],
            ["ext.visualEditor.switching", "1ixi2", [47, 199, 211, 214, 216], 4],
            ["ext.visualEditor.mwcore", "11x57", [447, 425, 434, 433, 128, 72, 10, 170], 4],
            ["ext.visualEditor.mwextensions", "1gvrd", [428, 458, 451, 453, 438, 455,
                440, 452, 441, 443
            ], 4],
            ["ext.visualEditor.mwextensions.desktop", "1gvrd", [436, 442, 81], 4],
            ["ext.visualEditor.mwformatting", "1uv01", [435], 4],
            ["ext.visualEditor.mwimage.core", "1wd1t", [435], 4],
            ["ext.visualEditor.mwimage", "14eb6", [439, 184, 37, 222, 226], 4],
            ["ext.visualEditor.mwlink", "t5wau", [435], 4],
            ["ext.visualEditor.mwmeta", "l2fmc", [441, 106], 4],
            ["ext.visualEditor.mwtransclusion", "18ut5", [435, 187], 4],
            ["treeDiffer", "ylkzm"],
            ["diffMatchPatch", "1f0tq"],
            ["ext.visualEditor.checkList", "fmel7", [429], 4],
            ["ext.visualEditor.diffing", "s5cx1", [445, 429, 444], 4],
            ["ext.visualEditor.diffPage.init.styles", "j4i7g"],
            ["ext.visualEditor.diffLoader", "1un0a", [413], 4],
            ["ext.visualEditor.diffPage.init", "1nh2n", [449, 199, 211, 214], 4],
            ["ext.visualEditor.language", "1g8pe", [429, 629, 115], 4],
            ["ext.visualEditor.mwlanguage", "1mecb", [429], 4],
            ["ext.visualEditor.mwalienextension", "1i211", [435], 4],
            ["ext.visualEditor.mwwikitext", "1wg05", [441, 92], 4],
            ["ext.visualEditor.mwgallery", "reer1", [435, 119, 184, 222], 4],
            [
                "ext.visualEditor.mwsignature", "1sewm", [443], 4
            ],
            ["ext.visualEditor.experimental", "1gvrd", [], 4],
            ["ext.visualEditor.icons", "1gvrd", [459, 460, 212, 213, 214, 216, 217, 218, 219, 220, 223, 224, 225, 210], 4],
            ["ext.visualEditor.moduleIcons", "9ws89"],
            ["ext.visualEditor.moduleIndicators", "7cejf"],
            ["ext.citoid.visualEditor", "8s3od", [252, 462]],
            ["ext.citoid.visualEditor.data", "1a3q4", [425]],
            ["ext.citoid.wikibase.init", "8dvhj"],
            ["ext.citoid.wikibase", "f33e6", [463, 36, 199]],
            ["ext.templateData", "1t2ui"],
            ["ext.templateDataGenerator.editPage", "1mtwk"],
            ["ext.templateDataGenerator.data", "196in", [196]],
            ["ext.templateDataGenerator.editTemplatePage.loading", "35mui"],
            ["ext.templateDataGenerator.editTemplatePage", "1ko39", [465, 470, 467, 33, 629, 47, 203, 208, 219, 220, 223]],
            ["ext.templateData.images", "19bfk"],
            ["ext.TemplateWizard", "1u6nc", [33, 170, 173, 187, 206, 208, 219]],
            ["ext.wikiLove.icon", "1c1zm"],
            ["ext.wikiLove.startup", "1y5cv", [36, 47, 167]],
            ["ext.wikiLove.local", "sv5za"],
            ["ext.wikiLove.init", "1y0df", [473]],
            [
                "mediawiki.libs.guiders", "1l1fg"
            ],
            ["ext.guidedTour.styles", "10sqr", [476, 167]],
            ["ext.guidedTour.lib.internal", "1uwi4", [87]],
            ["ext.guidedTour.lib", "1d5ph", [602, 478, 477]],
            ["ext.guidedTour.launcher", "6pn6x"],
            ["ext.guidedTour", "13bf4", [479]],
            ["ext.guidedTour.tour.firstedit", "g231q", [481]],
            ["ext.guidedTour.tour.test", "1g6st", [481]],
            ["ext.guidedTour.tour.onshow", "spz9g", [481]],
            ["ext.guidedTour.tour.uprightdownleft", "p83px", [481]],
            ["mobile.pagelist.styles", "ru5wt"],
            ["mobile.pagesummary.styles", "1gsis"],
            ["mobile.placeholder.images", "z7olw"],
            ["mobile.userpage.styles", "uqgtg"],
            ["mobile.startup.images", "cfjw8"],
            ["mobile.init.styles", "1c706"],
            ["mobile.init", "1uoto", [84, 495]],
            ["mobile.ooui.icons", "eoj45"],
            ["mobile.user.icons", "15wra"],
            ["mobile.startup", "10tud", [122, 197, 74, 45, 167, 169, 85, 493, 486, 487, 488, 490]],
            ["mobile.editor.overlay", "19i3q", [49, 92, 66, 168, 172, 497, 495, 494, 199, 216]],
            ["mobile.editor.images", "1rmeg"],
            ["mobile.talk.overlays", "2nv1c", [166, 496]],
            ["mobile.mediaViewer", "99jck", [495]],
            [
                "mobile.languages.structured", "yejd7", [495]
            ],
            ["mobile.special.mobileoptions.styles", "1a9oh"],
            ["mobile.special.mobileoptions.scripts", "8qd6k", [495]],
            ["mobile.special.nearby.styles", "1i12k"],
            ["mobile.special.userlogin.scripts", "1rm8n"],
            ["mobile.special.nearby.scripts", "tr0ru", [84, 503, 495]],
            ["mobile.special.mobilediff.images", "bep8u"],
            ["skins.minerva.base.styles", "185er"],
            ["skins.minerva.content.styles.images", "1pd65"],
            ["skins.minerva.icons.loggedin", "jxc2f"],
            ["skins.minerva.amc.styles", "8zh2z"],
            ["skins.minerva.overflow.icons", "1ul5y"],
            ["skins.minerva.icons.wikimedia", "13v6n"],
            ["skins.minerva.icons.images.scripts.misc", "15akx"],
            ["skins.minerva.icons.page.issues.uncolored", "j4w7d"],
            ["skins.minerva.icons.page.issues.default.color", "zuf4b"],
            ["skins.minerva.icons.page.issues.medium.color", "kpohz"],
            ["skins.minerva.mainPage.styles", "c6dd8"],
            ["skins.minerva.userpage.styles", "juhd4"],
            ["skins.minerva.talk.styles", "18sa5"],
            ["skins.minerva.personalMenu.icons", "es6ks"],
            [
                "skins.minerva.mainMenu.advanced.icons", "1vueg"
            ],
            ["skins.minerva.mainMenu.icons", "9cenk"],
            ["skins.minerva.mainMenu.styles", "crld4"],
            ["skins.minerva.loggedin.styles", "5kzqc"],
            ["skins.minerva.scripts", "x0di8", [84, 91, 166, 495, 513, 515, 516, 514, 522, 523, 526]],
            ["skins.minerva.messageBox.styles", "uyzzc"],
            ["skins.minerva.categories.styles", "zy1j5"],
            ["ext.math.styles", "1v9c1"],
            ["ext.math.scripts", "16fem"],
            ["mw.widgets.MathWbEntitySelector", "amyw4", [56, 170, 764, 208]],
            ["ext.math.visualEditor", "a2146", [528, 435]],
            ["ext.math.visualEditor.mathSymbolsData", "ltjso", [531]],
            ["ext.math.visualEditor.mathSymbols", "1tj2q", [532]],
            ["ext.math.visualEditor.chemSymbolsData", "ar9ku", [531]],
            ["ext.math.visualEditor.chemSymbols", "r7qo8", [534]],
            ["ext.babel", "16oqx"],
            ["ext.vipsscaler", "1jqvo", [538]],
            ["jquery.ucompare", "1w08f"],
            ["ext.interwiki.specialpage", "pge0w"],
            ["ext.echo.logger", "18jip", [85, 196]],
            ["ext.echo.ui.desktop", "83l7o", [547, 542]],
            ["ext.echo.ui", "9cq1x", [543, 540, 769, 203, 212, 213, 219, 223, 224, 225]],
            ["ext.echo.dm",
                "17780", [546, 37]
            ],
            ["ext.echo.api", "1uqvr", [56]],
            ["ext.echo.mobile", "ml6n6", [542, 197, 45]],
            ["ext.echo.init", "1pypr", [544]],
            ["ext.echo.styles.badge", "10ydp"],
            ["ext.echo.styles.notifications", "1iym0"],
            ["ext.echo.styles.alert", "2cewx"],
            ["ext.echo.special", "m2x0s", [551, 542]],
            ["ext.echo.styles.special", "16s4x"],
            ["ext.thanks.images", "1tfda"],
            ["ext.thanks", "mqgir", [47, 90]],
            ["ext.thanks.corethank", "odaqh", [553, 19, 208]],
            ["ext.thanks.mobilediff", "tlk9a", [552, 495]],
            ["ext.thanks.flowthank", "1lb0c", [553, 208]],
            ["ext.flow.contributions", "1cyi3"],
            ["ext.flow.contributions.styles", "rx8lo"],
            ["ext.flow.templating", "1cgtp", [562, 85, 37]],
            ["ext.flow.mediawiki.ui.form", "dxlpl"],
            ["ext.flow.styles.base", "16q76"],
            ["mediawiki.template.handlebars", "1uj4u", [44]],
            ["ext.flow.components", "1ez0r", [570, 559, 34, 84, 196]],
            ["ext.flow.dm", "q0zhg", [47, 196]],
            ["ext.flow.ui", "149qv", [564, 568, 407, 92, 74, 85, 199, 214, 217, 225]],
            ["ext.flow", "1k71y", [563, 569, 565]],
            ["ext.flow.visualEditor", "uhodx", [568, 432, 414, 437, 454]],
            [
                "ext.flow.visualEditor.icons", "r8sxn"
            ],
            ["ext.flow.jquery.conditionalScroll", "15yer"],
            ["ext.flow.jquery.findWithParent", "ihgvx"],
            ["ext.disambiguator", "i6ad2!", [47, 66]],
            ["ext.disambiguator.visualEditor", "k4v7h", [442]],
            ["ext.discussionTools.init.styles", "ffsrc"],
            ["ext.discussionTools.init", "lf3c0", [573, 423, 74, 85, 37, 208, 405, 14]],
            ["ext.discussionTools.debug", "dqy0n", [574]],
            ["ext.discussionTools.ReplyWidget", "1vdj3", [862, 574, 172, 175, 203]],
            ["ext.discussionTools.ReplyWidgetPlain", "bal4k", [576, 434, 92]],
            ["ext.discussionTools.ReplyWidgetVisual", "1e50v", [576, 427, 456, 454]],
            ["ext.codeEditor", "v0khv", [580], 3],
            ["jquery.codeEditor", "y92is", [582, 581, 363, 208], 3],
            ["ext.codeEditor.icons", "m5n7f"],
            ["ext.codeEditor.ace", "1nct8", [], 5],
            ["ext.codeEditor.ace.modes", "5rdce", [582], 5],
            ["ext.scribunto.errors", "n29ns", [36]],
            ["ext.scribunto.logs", "kr527"],
            ["ext.scribunto.edit", "azbij", [28, 47]],
            ["ext.relatedArticles.styles", "1mvsj"],
            ["ext.relatedArticles.readMore.bootstrap", "10r4l!", [84, 85]],
            [
                "ext.relatedArticles.readMore", "1w1sl!", [87, 196]
            ],
            ["ext.RevisionSlider.lazyCss", "hjlz2"],
            ["ext.RevisionSlider.lazyJs", "cqh11", [594, 224]],
            ["ext.RevisionSlider.init", "11vwm", [594, 595, 223]],
            ["ext.RevisionSlider.noscript", "1fgu3"],
            ["ext.RevisionSlider.Settings", "7m4kh", [74, 85]],
            ["ext.RevisionSlider.Slider", "1qe7k", [596, 36, 84, 37, 199, 219, 224]],
            ["ext.RevisionSlider.dialogImages", "14ayx"],
            ["ext.TwoColConflict.SplitJs", "9yu8o", [599, 600, 72, 74, 85, 199, 219]],
            ["ext.TwoColConflict.SplitCss", "1yrn4"],
            ["ext.TwoColConflict.Split.TourImages", "17u8b"],
            ["ext.TwoColConflict.Util", "17tmk"],
            ["ext.TwoColConflict.JSCheck", "1kalq"],
            ["ext.eventLogging", "1ykf6", [85]],
            ["ext.eventLogging.debug", "aryjb"],
            ["ext.eventLogging.jsonSchema", "uo1an"],
            ["ext.eventLogging.jsonSchema.styles", "125zq"],
            ["ext.wikimediaEvents", "12dvt", [602, 84, 91, 74, 93]],
            ["ext.wikimediaEvents.wikibase", "8bkyv", [602, 91]],
            ["ext.navigationTiming", "1w6gk", [602]],
            ["ext.uls.common", "19z0t", [629, 74, 85]],
            ["ext.uls.compactlinks", "4tv36", [609, 167]],
            [
                "ext.uls.ime", "1xepw", [619, 627]
            ],
            ["ext.uls.displaysettings", "yx678", [611, 618, 164, 165]],
            ["ext.uls.geoclient", "ijzbu", [90]],
            ["ext.uls.i18n", "37yzm", [25, 87]],
            ["ext.uls.interface", "1rwnj", [625, 203, 219]],
            ["ext.uls.interlanguage", "1lz4l"],
            ["ext.uls.languagenames", "l6j40"],
            ["ext.uls.languagesettings", "14sbw", [620, 621, 630, 167]],
            ["ext.uls.mediawiki", "joiy0", [609, 617, 620, 625, 628]],
            ["ext.uls.messages", "1xg6v", [614]],
            ["ext.uls.preferences", "w4ber", [74, 85]],
            ["ext.uls.preferencespage", "39jcv"],
            ["ext.uls.pt", "higlr"],
            ["ext.uls.setlang", "jyf1p", [84, 47, 167]],
            ["ext.uls.webfonts", "yefw5", [621]],
            ["ext.uls.webfonts.repository", "llohn"],
            ["jquery.ime", "xh81e"],
            ["jquery.uls", "1v3z2", [25, 629, 630]],
            ["jquery.uls.data", "5c8ox"],
            ["jquery.uls.grid", "cnek2"],
            ["rangy.core", "1sbtu"],
            ["ext.cx.contributions", "1smn4", [87, 200, 213, 214]],
            ["ext.cx.model", "1crl5"],
            ["ext.cx.icons", "db28b"],
            ["ext.cx.dashboard", "ycta2", [654, 30, 170, 37, 638, 664, 639, 214, 216, 222, 223]],
            ["sx.publishing.followup", "oet7b", [638, 637, 38]],
            ["mw.cx.util",
                "11sfj", [633, 85]
            ],
            ["mw.cx.SiteMapper", "1vdej", [633, 56, 85]],
            ["mw.cx.ui.LanguageFilter", "5r0ra", [619, 167, 658, 637, 219]],
            ["ext.cx.wikibase.link", "1jm3k"],
            ["ext.cx.uls.quick.actions", "18xb0!", [615, 638]],
            ["ext.cx.eventlogging.campaigns", "1ghta", [85]],
            ["ext.cx.interlanguagelink.init", "1wkfl", [609]],
            ["ext.cx.interlanguagelink", "14qiw", [609, 638, 203, 219]],
            ["ext.cx.translation.conflict", "1mang", [113]],
            ["ext.cx.stats", "ut2e0", [647, 655, 654, 629, 37, 638]],
            ["chart.js", "1ww4v"],
            ["ext.cx.entrypoints.newarticle", "1xcyc!", [655, 113, 167, 200]],
            ["ext.cx.entrypoints.newarticle.veloader", "1vl89!"],
            ["ext.cx.entrypoints.ulsrelevantlanguages", "1adjx!", [609, 638, 38]],
            ["ext.cx.entrypoints.newbytranslation", "zcn70!", [638, 637, 203, 213, 219]],
            ["ext.cx.betafeature.init", "12fk9"],
            ["ext.cx.entrypoints.contributionsmenu", "1u056!", [634, 655, 113, 169]],
            ["ext.cx.widgets.spinner", "15p3u", [633]],
            ["ext.cx.widgets.callout", "72taa"],
            ["mw.cx.dm", "x7cf8", [633, 196]],
            ["mw.cx.dm.Translation", "hcthb", [656]],
            ["mw.cx.ui", "gw1gp", [633, 199]],
            [
                "mw.cx.visualEditor", "1g6m2", [252, 432, 414, 437, 660, 661]
            ],
            ["ve.ce.CXLintableNode", "fujzh", [429]],
            ["ve.dm.CXLintableNode", "19o1c", [429, 656]],
            ["mw.cx.init", "vnj74", [654, 442, 195, 668, 664, 660, 661, 663]],
            ["ve.init.mw.CXTarget", "g9x87", [432, 638, 657, 658, 637]],
            ["mw.cx.ui.Infobar", "1eqc5", [658, 637, 212, 219]],
            ["mw.cx.ui.CaptchaDialog", "ykodb", [772, 658]],
            ["mw.cx.ui.LoginDialog", "1xwu4", [87, 658]],
            ["mw.cx.tools.InstructionsTool", "16j4z", [113, 668, 45]],
            ["mw.cx.tools.TranslationTool", "d16kx", [658]],
            ["mw.cx.ui.FeatureDiscoveryWidget", "2tta5", [72, 658]],
            ["mw.cx.skin", "1v79t"],
            ["mw.externalguidance.init", "1jndi", [84]],
            ["mw.externalguidance", "crpwi", [56, 495, 673, 216]],
            ["mw.externalguidance.icons", "4ibq8"],
            ["mw.externalguidance.special", "63bxm", [629, 56, 165, 495, 673]],
            ["wikibase.client.init", "1ubuy"],
            ["wikibase.client.miscStyles", "6yl1g"],
            ["wikibase.client.linkitem.init", "1k50f", [28]],
            ["jquery.wikibase.linkitem", "oscxl", [28, 35, 36, 56, 764, 763, 868]],
            ["wikibase.client.action.edit.collapsibleFooter", "znjul", [27, 64, 74]],
            ["ext.wikimediaBadges", "19qhw"],
            ["ext.TemplateSandbox.top", "1lfwo"],
            ["ext.TemplateSandbox", "16kj6", [681]],
            ["ext.TemplateSandbox.visualeditor", "3vawa", [170, 199]],
            ["ext.jsonConfig", "ung4s"],
            ["ext.jsonConfig.edit", "1lc76", [33, 185, 208]],
            ["ext.graph.styles", "1dtkc"],
            ["ext.graph.data", "lnpu6"],
            ["ext.graph.loader", "1rnlv", [47]],
            ["ext.graph.vega1", "8dzub", [687, 84]],
            ["ext.graph.vega2", "gs3ws", [687, 84]],
            ["ext.graph.sandbox", "e2bnd", [579, 690, 49]],
            ["ext.graph.visualEditor", "1f5h1", [687, 439, 185]],
            ["ext.MWOAuth.styles", "mma12"],
            ["ext.MWOAuth.AuthorizeDialog", "13dav", [36]],
            ["ext.oath.totp.showqrcode", "b22bu"],
            ["ext.oath.totp.showqrcode.styles", "5iqin"],
            ["ext.webauthn.ui.base", "1wcgx", [113, 199]],
            ["ext.webauthn.register", "1hybj", [697, 47]],
            ["ext.webauthn.login", "9gli2", [697]],
            ["ext.webauthn.manage", "jdga5", [697, 47]],
            ["ext.webauthn.disable", "1rdxq", [697]],
            ["ext.ores.highlighter", "5907c"],
            ["ext.ores.styles", "1ltne"],
            ["ext.ores.api", "f48ku"],
            ["ext.checkUser", "2mbwn", [31, 84, 70, 74, 170, 214, 216, 219, 221, 223, 225]],
            ["ext.checkUser.styles", "1s9ge"],
            ["ext.guidedTour.tour.checkuserinvestigateform", "10ebi", [481]],
            ["ext.guidedTour.tour.checkuserinvestigate", "179e2", [705, 481]],
            ["ext.kartographer", "1opht"],
            ["ext.kartographer.style", "ikuxh"],
            ["ext.kartographer.site", "1n5nk"],
            ["mapbox", "1ayr4"],
            ["leaflet.draw", "1k3cq", [712]],
            ["ext.kartographer.link", "91kes", [716, 197]],
            ["ext.kartographer.box", "fqqhq", [717, 728, 711, 710, 720, 84, 47, 222]],
            ["ext.kartographer.linkbox", "6et9q", [720]],
            ["ext.kartographer.data", "mfuen"],
            ["ext.kartographer.dialog", "1dl91", [712, 197, 203, 208, 219]],
            ["ext.kartographer.dialog.sidebar", "6vtbe", [74, 219, 224]],
            ["ext.kartographer.util", "1d9jl", [709]],
            ["ext.kartographer.frame", "zg7jg", [715, 197]],
            ["ext.kartographer.staticframe", "n5q2i", [716, 197, 222]],
            ["ext.kartographer.preview", "1pycu"],
            ["ext.kartographer.editing", "dox2g", [47]],
            ["ext.kartographer.editor", "1gvrd", [715, 713]],
            ["ext.kartographer.visualEditor", "8bgdh", [720, 435, 221]],
            ["ext.kartographer.lib.prunecluster", "1mdne", [712]],
            [
                "ext.kartographer.lib.topojson", "1em2u", [712]
            ],
            ["ext.kartographer.wv", "mdqq2", [727, 216]],
            ["ext.kartographer.specialMap", "19ibl"],
            ["ext.pageviewinfo", "d8trq", [690, 199]],
            ["ext.3d", "rctz1", [28]],
            ["ext.3d.styles", "1p924"],
            ["mmv.3d", "1fut0", [732, 387]],
            ["mmv.3d.head", "or57n", [732, 200, 211, 213]],
            ["ext.3d.special.upload", "b1fz9", [737, 152]],
            ["ext.3d.special.upload.styles", "u2y0d"],
            ["ext.GlobalPreferences.global", "1m49p", [170, 178, 188]],
            ["ext.GlobalPreferences.global-nojs", "f4960"],
            ["ext.GlobalPreferences.local-nojs", "lra5j"],
            ["ext.growthExperiments.mobileMenu.icons", "7m291"],
            ["ext.growthExperiments.SuggestedEditSession", "fw8iv", [84, 74, 85, 196]],
            ["ext.growthExperiments.HelpPanelCta.styles", "e2qi2"],
            ["ext.growthExperiments.HomepageDiscovery.styles", "o554i"],
            ["ext.growthExperiments.Homepage", "19xc3", [84, 85, 208]],
            ["ext.growthExperiments.Homepage.Mentorship", "10p7p", [752, 742, 197]],
            ["ext.growthExperiments.Homepage.SuggestedEdits", "1k47j", [762, 742, 72, 197, 203, 208, 213, 216, 222]],
            [
                "ext.growthExperiments.Homepage.styles", "1y5ri"
            ],
            ["ext.growthExperiments.StructuredTask", "1ok1a", [751, 758, 441, 197, 222, 223, 224]],
            ["ext.growthExperiments.StructuredTask.desktop", "1kssf", [749, 415]],
            ["ext.growthExperiments.StructuredTask.PreEdit", "1d2nu", [762, 742, 203, 208]],
            ["ext.growthExperiments.Help", "pu1uz", [762, 758, 84, 74, 85, 203, 208, 212, 214, 215, 216, 219, 225]],
            ["ext.growthExperiments.HelpPanel", "3trse", [752, 743, 751, 72, 224]],
            ["ext.growthExperiments.HelpPanel.init", "1nbnx", [742]],
            ["ext.growthExperiments.PostEdit", "d1r29", [762, 742, 758, 208, 224]],
            ["ext.growthExperiments.Account", "aljrq", [197, 203]],
            ["ext.growthExperiments.Account.styles", "xgpuy"],
            ["ext.growthExperiments.icons", "puw3w"],
            ["ext.growthExperiments.MentorDashboard", "1xssf", [758, 187, 208, 215, 216, 219, 222, 223, 224, 225]],
            ["ext.growthExperiments.MentorDashboard.styles", "1446w"],
            ["ext.growthExperiments.MentorDashboard.Discovery", "1xtyr", [72]],
            ["ext.growthExperiments.DataStore", "7olg6", [87, 200]],
            ["mw.config.values.wbSiteDetails", "bzsnp"],
            [
                "mw.config.values.wbRepo", "18lj4"
            ],
            ["ext.centralauth.globalrenamequeue", "1pbzt"],
            ["ext.centralauth.globalrenamequeue.styles", "z2t5w"],
            ["ext.guidedTour.tour.firsteditve", "1rzvs", [481]],
            ["ext.echo.emailicons", "noi1b"],
            ["ext.echo.secondaryicons", "ong34"],
            ["ext.guidedTour.tour.flowOptIn", "kcrzr", [481]],
            ["ext.wikimediaEvents.visualEditor", "7jlvn", [413]],
            ["mw.cx.externalmessages", "1hr1l"],
            ["ext.gadget.blackskin", "qpxla", [], 2],
            ["ext.gadget.historiconumerado", "ruv4n", [], 2],
            ["ext.gadget.EsconderCentralnoticeDoMeta", "po1vy", [], 2],
            ["ext.gadget.traducaointerwiki", "j9mvl", [], 2],
            ["ext.gadget.traductor-google", "1blfu", [], 2],
            ["ext.gadget.LanguageConverter", "xclqx", [], 2],
            ["ext.gadget.UTCLiveClock", "vkzm5", [47], 2],
            ["ext.gadget.Desambiguacoes", "14tlz", [], 2],
            ["ext.gadget.Redirecionamentos", "tq0f8", [87], 2],
            ["ext.gadget.Topicon", "1g72w", [87], 2],
            ["ext.gadget.Metacaixa", "hgfov", [], 2],
            ["ext.gadget.TitleRewrite", "1xtj6", [], 2],
            ["ext.gadget.ElementosOcultaveis", "srrek", [], 2],
            ["ext.gadget.FeedbackHighlight",
                "18sln", [], 2
            ],
            ["ext.gadget.FeedbackHighlight-base", "1wg8f", [], 2],
            ["ext.gadget.Compactar_refs", "w5fmb", [], 2],
            ["ext.gadget.ocultarrefs", "91mpn", [87], 2],
            ["ext.gadget.ReferenceTooltips", "1qdvc", [], 2],
            ["ext.gadget.addNewSectionLink", "1vr0s", [], 2],
            ["ext.gadget.hideRefBrakets", "h9vxn", [], 2],
            ["ext.gadget.mobile-sidebar", "1pgrk", [], 2],
            ["ext.gadget.TipsForSlangs", "9c9p5", [], 2],
            ["ext.gadget.WikidataInfo", "cj6m4", [113], 2],
            ["ext.gadget.dark-mode-toggle", "ri082", [47, 84, 74, 13], 2],
            ["ext.gadget.refToolbar", "1mcd3", [5], 2],
            ["ext.gadget.ProveIt", "pu6eq", [], 2],
            ["ext.gadget.HotCat", "ydxpl", [], 2],
            ["ext.gadget.wikEd", "1sr28", [17], 2],
            ["ext.gadget.wikEdDiff", "jbfmn", [], 2],
            ["ext.gadget.btm-actions", "1tyro", [], 2],
            ["ext.gadget.fastbuttons", "w5i4d", [87], 2],
            ["ext.gadget.APC", "1sshk", [], 2],
            ["ext.gadget.rev-e-avisos", "x0zs0", [87], 2],
            ["ext.gadget.RTRC", "3yfcd", [], 2],
            ["ext.gadget.antivandaltool", "96wd3", [87], 2],
            ["ext.gadget.UploadForm", "1ihlk", [87], 2],
            ["ext.gadget.NewVillagePump", "c3wcj", [], 2],
            ["ext.gadget.wikibugs",
                "qnlkw", [87], 2
            ],
            ["ext.gadget.ArtigosParaEliminar", "1ldaz", [87], 2],
            ["ext.gadget.urldecoder", "6c48b", [], 2],
            ["ext.gadget.charinsert", "of07v", [], 2],
            ["ext.gadget.DotsSyntaxHighlighter", "1gj3g", [17], 2],
            ["ext.gadget.requestForAdminship", "12aay", [], 2],
            ["ext.gadget.contentFeatured", "15maa", [853, 36], 2],
            ["ext.gadget.afltab", "1r0rs", [87], 2],
            ["ext.gadget.exlinks", "1gxs3", [121], 2],
            ["ext.gadget.FlecheHaut", "cgswd", [87], 2],
            ["ext.gadget.edittop", "3han2", [87], 2],
            ["ext.gadget.historicomelhorado", "1ic94", [], 2],
            ["ext.gadget.destacar", "r1d00", [], 2],
            ["ext.gadget.removeAccessKeys", "ttpwm", [87], 2],
            ["ext.gadget.bottomtabs", "olcke", [], 2],
            ["ext.gadget.lastdiff", "17ora", [87], 2],
            ["ext.gadget.hideSidebar", "1cfu9", [], 2],
            ["ext.gadget.contribsrange", "5na8e", [87, 28], 2],
            ["ext.gadget.Navigation_popups", "14sk1", [], 2],
            ["ext.gadget.OngletPurge", "bf7wm", [87], 2],
            ["ext.gadget.Pesquisa-por-dominio", "1catg", [], 2],
            ["ext.gadget.EnhancedSearch", "vnok3", [], 2],
            ["ext.gadget.WikiMiniAtlas", "52i99", [], 2],
            ["ext.gadget.show-sysop-activity", "17634", [121], 2],
            ["ext.gadget.PagesForDeletion", "i5epw", [], 2],
            ["ext.gadget.validateBlockRollbackers", "n3eqk", [], 2],
            ["ext.gadget.BugStatusUpdate", "xnjpk", [], 2],
            ["ext.gadget.rightsfilter", "efonq", [87], 2],
            ["ext.gadget.lastEditUser", "1sknk", [87], 2],
            ["ext.gadget.Direct-link-to-Commons", "1b525", [87], 2],
            ["ext.gadget.geonotice", "15d21", [], 2],
            ["ext.gadget.categoriesOnTop", "oziex", [], 2],
            ["ext.gadget.highlightRedirects", "t1rcf", [], 2],
            ["ext.gadget.watchUserContribs", "vxz87", [36, 35, 87, 167], 2],
            ["ext.gadget.dynamicGallery", "qt80i", [], 2],
            ["ext.gadget.MapFrame", "1bo5d", [], 2],
            ["ext.gadget.blocktab", "pe6vo", [87], 2],
            ["ext.gadget.DeletedContribsTab", "1uyxl", [87], 2],
            ["ext.gadget.SysopSuggestions", "1uojw", [30], 2],
            ["ext.gadget.userrights", "1y7lg", [87], 2],
            ["ext.gadget.CleanDeleteReasons", "1o1hc", [], 2],
            ["ext.gadget.blockNotificationButton", "tr244", [853, 167], 2],
            ["ext.gadget.arquivarPEs", "kah91", [47, 36], 2],
            ["ext.gadget.mediawiki.api.ptwiki", "1mdtf", [47], 2],
            ["ext.gadget.NewVillagePumpCore", "rko5v", [28, 853, 49], 2],
            ["ext.gadget.EnhancedSearchCore", "q6oi3", [], 2],
            ["ext.gadget.wikibugsCore", "1vuim", [85, 36], 2],
            ["ext.gadget.fastButtonsCore", "1c2zw", [853, 121, 35, 36], 2],
            ["ext.gadget.diffToolsCore", "aiatt", [853, 36], 2],
            ["ext.gadget.charinsert-core", "15v77", [33], 2],
            ["ext.gadget.geonotice-core", "3jri0", [87, 74], 2],
            ["ext.gadget.requestForAdminshipCore", "akhrg", [853, 36], 2],
            ["ext.confirmEdit.CaptchaInputWidget", "1dmj3", [200]],
            ["ext.globalCssJs.user", "1son6", [], 0, "metawiki"],
            ["ext.globalCssJs.user.styles", "1son6", [], 0, "metawiki"],
            ["ext.guidedTour.tour.RcFiltersIntro", "6hhu6", [481]],
            ["ext.guidedTour.tour.WlFiltersIntro", "ve6ri", [481]],
            ["ext.guidedTour.tour.RcFiltersHighlight", "ysard", [481]],
            ["wikibase.Site", "78xgv", [619]],
            ["ext.guidedTour.tour.helppanel", "1bf10", [481]],
            ["ext.guidedTour.tour.homepage_mentor", "qcqso", [481]],
            ["ext.guidedTour.tour.homepage_welcome", "19708", [481]],
            ["ext.guidedTour.tour.homepage_discovery", "1x3ni", [481]],
            ["mediawiki.messagePoster", "fp4uv", [56]]
        ]);
        mw.config.set(window.RLCONF || {});
        mw.
        loader.state(window.RLSTATE || {});
        mw.loader.load(window.RLPAGEMODULES || []);
        queue = window.RLQ || [];
        RLQ = [];
        RLQ.push = function(fn) {
            if (typeof fn === 'function') {
                fn();
            } else {
                RLQ[RLQ.length] = fn;
            }
        };
        while (queue[0]) {
            RLQ.push(queue.shift());
        }
        NORLQ = {
            push: function() {}
        };
    }());
}`,
`window.__SCRIPTS_LOADED__.runtime && ((window.webpackJsonp = window.webpackJsonp || []).push([
    [366], {
        Qrtf: function(t, e, n) {
            (function(e) {
                var n;
                n = function() {
                    "use strict";
                    var t = function() {
                            if ("undefined" != typeof Map) return Map;

                            function t(t, e) {
                                var n = -1;
                                return t.some((function(t, r) {
                                    return t[0] === e && (n = r, !0)
                                })), n
                            }
                            return function() {
                                function e() {
                                    this.__entries__ = []
                                }
                                var n = {
                                    size: {
                                        configurable: !0
                                    }
                                };
                                return n.size.get = function() {
                                    return this.__entries__.length
                                }, e.prototype.get = function(e) {
                                    var n = t(this.__entries__, e),
                                        r = this.__entries__[n];
                                    return r && r[1]
                                }, e.prototype.set = function(e, n) {
                                    var r = t(this.__entries__, e);
                                    ~r ? this.__entries__[r][1] = n : this.__entries__.push([e, n])
                                }, e.prototype.delete = function(e) {
                                    var n = this.__entries__,
                                        r = t(n, e);
                                    ~r && n.splice(r, 1)
                                }, e.prototype.has = function(e) {
                                    return !!~t(this.__entries__, e)
                                }, e.prototype.clear = function() {
                                    this.__entries__.splice(0)
                                }, e.prototype.forEach = function(t, e) {
                                    void 0 === e && (e = null);
                                    for (var n = 0, r = this.__entries__; n < r.length; n += 1) {
                                        var i = r[n];
                                        t.call(e, i[1], i[0])
                                    }
                                }, Object.defineProperties(e.prototype, n), e
                            }()
                        }(),
                        n = "undefined" != typeof window && "undefined" != typeof document && window.document === document,
                        r = void 0 !== e && e.Math === Math ? e : "undefined" != typeof self && self.Math === Math ? self : "undefined" != typeof window && window.Math === Math ? window : Function("return this")(),
                        i = "function" == typeof requestAnimationFrame ? requestAnimationFrame.bind(r) : function(t) {
                            return setTimeout((function() {
                                return t(Date.now())
                            }), 1e3 / 60)
                        },
                        o = ["top", "right", "bottom", "left", "width", "height", "size", "weight"],
                        s = "undefined" != typeof MutationObserver,
                        c = function() {
                            this.connected_ = !1, this.mutationEventsAdded_ = !1, this.mutationsObserver_ = null, this.observers_ = [], this.onTransitionEnd_ = this.onTransitionEnd_.bind(this), this.refresh = function(t, e) {
                                var n = !1,
                                    r = !1,
                                    o = 0;

                                function s() {
                                    n && (n = !1, t()), r && a()
                                }

                                function c() {
                                    i(s)
                                }

                                function a() {
                                    var t = Date.now();
                                    if (n) {
                                        if (t - o < 2) return;
                                        r = !0
                                    } else n = !0, r = !1, setTimeout(c, e);
                                    o = t
                                }
                                return a
                            }(this.refresh.bind(this), 20)
                        };
                    c.prototype.addObserver = function(t) {
                        ~this.observers_.indexOf(t) || this.observers_.push(t), this.connected_ || this.connect_()
                    }, c.prototype.removeObserver = function(t) {
                        var e = this.observers_,
                            n = e.indexOf(t);
                        ~n && e.splice(n, 1), !e.length && this.connected_ && this.disconnect_()
                    }, c.prototype.refresh = function() {
                        this.updateObservers_() && this.refresh()
                    }, c.prototype.updateObservers_ = function() {
                        var t = this.observers_.filter((function(t) {
                            return t.gatherActive(), t.hasActive()
                        }));
                        return t.forEach((function(t) {
                            return t.broadcastActive()
                        })), t.length > 0
                    }, c.prototype.connect_ = function() {
                        n && !this.connected_ && (document.addEventListener("transitionend", this.onTransitionEnd_), window.addEventListener("resize", this.refresh), s ? (this.mutationsObserver_ = new MutationObserver(this.refresh), this.mutationsObserver_.observe(document, {
                            attributes: !0,
                            childList: !0,
                            characterData: !0,
                            subtree: !0
                        })) : (document.addEventListener("DOMSubtreeModified", this.refresh), this.mutationEventsAdded_ = !0), this.connected_ = !0)
                    }, c.prototype.disconnect_ = function() {
                        n && this.connected_ && (document.removeEventListener("transitionend", this.onTransitionEnd_), window.removeEventListener("resize", this.refresh), this.mutationsObserver_ && this.mutationsObserver_.disconnect(), this.mutationEventsAdded_ && document.removeEventListener("DOMSubtreeModified", this.refresh), this.mutationsObserver_ = null, this.mutationEventsAdded_ = !1, this.connected_ = !1)
                    }, c.prototype.onTransitionEnd_ = function(t) {
                        var e = t.propertyName;
                        void 0 === e && (e = ""), o.some((function(t) {
                            return !!~e.indexOf(t)
                        })) && this.refresh()
                    }, c.getInstance = function() {
                        return this.instance_ || (this.instance_ = new c), this.instance_
                    }, c.instance_ = null;
                    var a = function(t, e) {
                            for (var n = 0, r = Object.keys(e); n < r.length; n += 1) {
                                var i = r[n];
                                Object.defineProperty(t, i, {
                                    value: e[i],
                                    enumerable: !1,
                                    writable: !1,
                                    configurable: !0
                                })
                            }
                            return t
                        },
                        h = function(t) {
                            return t && t.ownerDocument && t.ownerDocument.defaultView || r
                        },
                        u = l(0, 0, 0, 0);

                    function f(t) {
                        return parseFloat(t) || 0
                    }

                    function d(t) {
                        for (var e = [], n = arguments.length - 1; n-- > 0;) e[n] = arguments[n + 1];
                        return e.reduce((function(e, n) {
                            return e + f(t["border-" + n + "-width"])
                        }), 0)
                    }

                    function v(t) {
                        var e = t.clientWidth,
                            n = t.clientHeight;
                        if (!e && !n) return u;
                        var r = h(t).getComputedStyle(t),
                            i = function(t) {
                                for (var e = {}, n = 0, r = ["top", "right", "bottom", "left"]; n < r.length; n += 1) {
                                    var i = r[n],
                                        o = t["padding-" + i];
                                    e[i] = f(o)
                                }
                                return e
                            }(r),
                            o = i.left + i.right,
                            s = i.top + i.bottom,
                            c = f(r.width),
                            a = f(r.height);
                        if ("border-box" === r.boxSizing && (Math.round(c + o) !== e && (c -= d(r, "left", "right") + o), Math.round(a + s) !== n && (a -= d(r, "top", "bottom") + s)), ! function(t) {
                                return t === h(t).document.documentElement
                            }(t)) {
                            var v = Math.round(c + o) - e,
                                p = Math.round(a + s) - n;
                            1 !== Math.abs(v) && (c -= v), 1 !== Math.abs(p) && (a -= p)
                        }
                        return l(i.left, i.top, c, a)
                    }
                    var p = "undefined" != typeof SVGGraphicsElement ? function(t) {
                        return t instanceof h(t).SVGGraphicsElement
                    } : function(t) {
                        return t instanceof h(t).SVGElement && "function" == typeof t.getBBox
                    };

                    function _(t) {
                        return n ? p(t) ? function(t) {
                            var e = t.getBBox();
                            return l(0, 0, e.width, e.height)
                        }(t) : v(t) : u
                    }

                    function l(t, e, n, r) {
                        return {
                            x: t,
                            y: e,
                            width: n,
                            height: r
                        }
                    }
                    var b = function(t) {
                        this.broadcastWidth = 0, this.broadcastHeight = 0, this.contentRect_ = l(0, 0, 0, 0), this.target = t
                    };
                    b.prototype.isActive = function() {
                        var t = _(this.target);
                        return this.contentRect_ = t, t.width !== this.broadcastWidth || t.height !== this.broadcastHeight
                    }, b.prototype.broadcastRect = function() {
                        var t = this.contentRect_;
                        return this.broadcastWidth = t.width, this.broadcastHeight = t.height, t
                    };
                    var w = function(t, e) {
                            var n, r, i, o, s, c, h, u = (r = (n = e).x, i = n.y, o = n.width, s = n.height, c = "undefined" != typeof DOMRectReadOnly ? DOMRectReadOnly : Object, h = Object.create(c.prototype), a(h, {
                                x: r,
                                y: i,
                                width: o,
                                height: s,
                                top: i,
                                right: r + o,
                                bottom: s + i,
                                left: r
                            }), h);
                            a(this, {
                                target: t,
                                contentRect: u
                            })
                        },
                        y = function(e, n, r) {
                            if (this.activeObservations_ = [], this.observations_ = new t, "function" != typeof e) throw new TypeError("The callback provided as parameter 1 is not a function.");
                            this.callback_ = e, this.controller_ = n, this.callbackCtx_ = r
                        };
                    y.prototype.observe = function(t) {
                        if (!arguments.length) throw new TypeError("1 argument required, but only 0 present.");
                        if ("undefined" != typeof Element && Element instanceof Object) {
                            if (!(t instanceof h(t).Element)) throw new TypeError('parameter 1 is not of type "Element".');
                            var e = this.observations_;
                            e.has(t) || (e.set(t, new b(t)), this.controller_.addObserver(this), this.controller_.refresh())
                        }
                    }, y.prototype.unobserve = function(t) {
                        if (!arguments.length) throw new TypeError("1 argument required, but only 0 present.");
                        if ("undefined" != typeof Element && Element instanceof Object) {
                            if (!(t instanceof h(t).Element)) throw new TypeError('parameter 1 is not of type "Element".');
                            var e = this.observations_;
                            e.has(t) && (e.delete(t), e.size || this.controller_.removeObserver(this))
                        }
                    }, y.prototype.disconnect = function() {
                        this.clearActive(), this.observations_.clear(), this.controller_.removeObserver(this)
                    }, y.prototype.gatherActive = function() {
                        var t = this;
                        this.clearActive(), this.observations_.forEach((function(e) {
                            e.isActive() && t.activeObservations_.push(e)
                        }))
                    }, y.prototype.broadcastActive = function() {
                        if (this.hasActive()) {
                            var t = this.callbackCtx_,
                                e = this.activeObservations_.map((function(t) {
                                    return new w(t.target, t.broadcastRect())
                                }));
                            this.callback_.call(t, e, t), this.clearActive()
                        }
                    }, y.prototype.clearActive = function() {
                        this.activeObservations_.splice(0)
                    }, y.prototype.hasActive = function() {
                        return this.activeObservations_.length > 0
                    };
                    var m = "undefined" != typeof WeakMap ? new WeakMap : new t,
                        O = function(t) {
                            if (!(this instanceof O)) throw new TypeError("Cannot call a class as a function.");
                            if (!arguments.length) throw new TypeError("1 argument required, but only 0 present.");
                            var e = c.getInstance(),
                                n = new y(t, e, this);
                            m.set(this, n)
                        };
                    return ["observe", "unobserve", "disconnect"].forEach((function(t) {
                        O.prototype[t] = function() {
                            return (e = m.get(this))[t].apply(e, arguments);
                            var e
                        }
                    })), void 0 !== r.ResizeObserver ? r.ResizeObserver : (r.ResizeObserver = O, O)
                }, t.exports = n()
            }).call(this, n("fRV1"))
        },
        fRV1: function(t, e) {
            var n;
            n = function() {
                return this
            }();
            try {
                n = n || new Function("return this")()
            } catch (t) {
                "object" == typeof window && (n = window)
            }
            t.exports = n
        },
        w92O: function(t, e, n) {
            (function(t) {
                t.NativeResizeObserver = t.ResizeObserver, t.ResizeObserver = void 0, n("Qrtf"), t.PolyfillResizeObserver = t.ResizeObserver, t.NativeResizeObserver && (t.ResizeObserver = t.NativeResizeObserver)
            }).call(this, n("fRV1"))
        }
    },
    [
        ["w92O", 1]
    ]
]), window.__SCRIPTS_LOADED__.polyfills = !0);
//# sourceMappingURL=https://ton.local.twitter.com/responsive-web-internal/sourcemaps/client-web/polyfills.0eea9697.js.map`,
`(function(self, undefined) {
    function Call(t, l) {
        var n = arguments.length > 2 ? arguments[2] : [];
        if (!1 === IsCallable(t)) throw new TypeError(Object.prototype.toString.call(t) + "is not a function.");
        return t.apply(l, n)
    }

    function Get(n, t) {
        return n[t]
    }

    function HasOwnProperty(r, t) {
        return Object.prototype.hasOwnProperty.call(r, t)
    }

    function IsCallable(n) {
        return "function" == typeof n
    }

    function ToObject(e) {
        if (null === e || e === undefined) throw TypeError();
        return Object(e)
    }

    function GetV(t, e) {
        return ToObject(t)[e]
    }

    function GetMethod(e, n) {
        var r = GetV(e, n);
        if (null === r || r === undefined) return undefined;
        if (!1 === IsCallable(r)) throw new TypeError("Method not callable: " + n);
        return r
    }

    function Type(e) {
        switch (typeof e) {
            case "undefined":
                return "undefined";
            case "boolean":
                return "boolean";
            case "number":
                return "number";
            case "string":
                return "string";
            case "symbol":
                return "symbol";
            default:
                return null === e ? "null" : "Symbol" in self && (e instanceof self.Symbol || e.constructor === self.Symbol) ? "symbol" : "object"
        }
    }

    function OrdinaryToPrimitive(r, t) {
        if ("string" === t) var e = ["toString", "valueOf"];
        else e = ["valueOf", "toString"];
        for (var i = 0; i < e.length; ++i) {
            var n = e[i],
                a = Get(r, n);
            if (IsCallable(a)) {
                var o = Call(a, r);
                if ("object" !== Type(o)) return o
            }
        }
        throw new TypeError("Cannot convert to primitive.")
    }

    function ToPrimitive(e) {
        var t = arguments.length > 1 ? arguments[1] : undefined;
        if ("object" === Type(e)) {
            if (arguments.length < 2) var i = "default";
            else t === String ? i = "string" : t === Number && (i = "number");
            var r = "function" == typeof self.Symbol && "symbol" == typeof self.Symbol.toPrimitive ? GetMethod(e, self.Symbol.toPrimitive) : undefined;
            if (r !== undefined) {
                var n = Call(r, e, [i]);
                if ("object" !== Type(n)) return n;
                throw new TypeError("Cannot convert exotic object to primitive.")
            }
            return "default" === i && (i = "number"), OrdinaryToPrimitive(e, i)
        }
        return e
    }

    function ToString(t) {
        switch (Type(t)) {
            case "symbol":
                throw new TypeError("Cannot convert a Symbol value to a string");
            case "object":
                return ToString(ToPrimitive(t, String));
            default:
                return String(t)
        }
    }

    function ToPropertyKey(r) {
        var i = ToPrimitive(r, String);
        return "symbol" === Type(i) ? i : ToString(i)
    }
    if (!("defineProperty" in Object && function() {
            try {
                var e = {}
                return Object.defineProperty(e, "test", {
                    value: 42
                }), !0
            } catch (t) {
                return !1
            }
        }())) {
        ! function(e) {
            var t = Object.prototype.hasOwnProperty.call(Object.prototype, "__defineGetter__"),
                r = "A property cannot both have accessors and be writable or have a value";
            Object.defineProperty = function n(o, i, c) {
                if (e && (o === window || o === document || o === Element.prototype || o instanceof Element)) return e(o, i, c);
                if (null === o || !(o instanceof Object || "object" == typeof o)) throw new TypeError("Object.defineProperty called on non-object");
                if (!(c instanceof Object)) throw new TypeError("Property description must be an object");
                var a = String(i),
                    f = "value" in c || "writable" in c,
                    p = "get" in c && typeof c.get,
                    s = "set" in c && typeof c.set;
                if (p) {
                    if ("function" !== p) throw new TypeError("Getter must be a function");
                    if (!t) throw new TypeError("Getters & setters cannot be defined on this javascript engine");
                    if (f) throw new TypeError(r);
                    Object.__defineGetter__.call(o, a, c.get)
                } else o[a] = c.value;
                if (s) {
                    if ("function" !== s) throw new TypeError("Setter must be a function");
                    if (!t) throw new TypeError("Getters & setters cannot be defined on this javascript engine");
                    if (f) throw new TypeError(r);
                    Object.__defineSetter__.call(o, a, c.set)
                }
                return "value" in c && (o[a] = c.value), o
            }
        }(Object.defineProperty);
    }

    function CreateMethodProperty(e, r, t) {
        var a = {
            value: t,
            writable: !0,
            enumerable: !1,
            configurable: !0
        };
        Object.defineProperty(e, r, a)
    }
    if (!("bind" in Function.prototype)) {
        CreateMethodProperty(Function.prototype, "bind", function t(n) {
            var r = Array,
                o = Object,
                e = r.prototype,
                l = function g() {},
                p = e.slice,
                a = e.concat,
                i = e.push,
                c = Math.max,
                u = this;
            if (!IsCallable(u)) throw new TypeError("Function.prototype.bind called on incompatible " + u);
            for (var y, h = p.call(arguments, 1), s = function() {
                    if (this instanceof y) {
                        var t = u.apply(this, a.call(h, p.call(arguments)));
                        return o(t) === t ? t : this
                    }
                    return u.apply(n, a.call(h, p.call(arguments)))
                }, f = c(0, u.length - h.length), b = [], d = 0; d < f; d++) i.call(b, "$" + d);
            return y = Function("binder", "return function (" + b.join(",") + "){ return binder.apply(this, arguments); }")(s), u.prototype && (l.prototype = u.prototype, y.prototype = new l, l.prototype = null), y
        });
    }
    if (!("getOwnPropertyDescriptor" in Object && "function" == typeof Object.getOwnPropertyDescriptor && function() {
            try {
                return "3" === Object.getOwnPropertyDescriptor("13.7", 1).value
            } catch (t) {
                return !1
            }
        }())) {
        ! function() {
            var e = Object.getOwnPropertyDescriptor,
                t = function() {
                    try {
                        return 1 === Object.defineProperty(document.createElement("div"), "one", {
                            get: function() {
                                return 1
                            }
                        }).one
                    } catch (e) {
                        return !1
                    }
                },
                r = {}.toString,
                n = "".split;
            CreateMethodProperty(Object, "getOwnPropertyDescriptor", function c(o, i) {
                var a = ToObject(o);
                a = ("string" === Type(a) || a instanceof String) && "[object String]" == r.call(o) ? n.call(o, "") : Object(o);
                var u = ToPropertyKey(i);
                if (t) try {
                    return e(a, u)
                } catch (l) {}
                if (HasOwnProperty(a, u)) return {
                    enumerable: !0,
                    configurable: !0,
                    writable: !0,
                    value: a[u]
                }
            })
        }();
    }
    if (!("keys" in Object && function() {
            return 2 === Object.keys(arguments).length
        }(1, 2) && function() {
            try {
                return Object.keys(""), !0
            } catch (t) {
                return !1
            }
        }())) {
        CreateMethodProperty(Object, "keys", function() {
            "use strict";

            function t(t) {
                var e = r.call(t),
                    n = "[object Arguments]" === e;
                return n || (n = "[object Array]" !== e && null !== t && "object" == typeof t && "number" == typeof t.length && t.length >= 0 && "[object Function]" === r.call(t.callee)), n
            }
            var e = Object.prototype.hasOwnProperty,
                r = Object.prototype.toString,
                n = Object.prototype.propertyIsEnumerable,
                o = !n.call({
                    toString: null
                }, "toString"),
                l = n.call(function() {}, "prototype"),
                c = ["toString", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "constructor"],
                i = function(t) {
                    var e = t.constructor;
                    return e && e.prototype === t
                },
                u = {
                    $console: !0,
                    $external: !0,
                    $frame: !0,
                    $frameElement: !0,
                    $frames: !0,
                    $innerHeight: !0,
                    $innerWidth: !0,
                    $outerHeight: !0,
                    $outerWidth: !0,
                    $pageXOffset: !0,
                    $pageYOffset: !0,
                    $parent: !0,
                    $scrollLeft: !0,
                    $scrollTop: !0,
                    $scrollX: !0,
                    $scrollY: !0,
                    $self: !0,
                    $webkitIndexedDB: !0,
                    $webkitStorageInfo: !0,
                    $window: !0
                },
                a = function() {
                    if ("undefined" == typeof window) return !1;
                    for (var t in window) try {
                        if (!u["$" + t] && e.call(window, t) && null !== window[t] && "object" == typeof window[t]) try {
                            i(window[t])
                        } catch (r) {
                            return !0
                        }
                    } catch (r) {
                        return !0
                    }
                    return !1
                }(),
                f = function(t) {
                    if ("undefined" == typeof window || !a) return i(t);
                    try {
                        return i(t)
                    } catch (e) {
                        return !1
                    }
                };
            return function p(n) {
                var i = "[object Function]" === r.call(n),
                    u = t(n),
                    a = "[object String]" === r.call(n),
                    p = [];
                if (n === undefined || null === n) throw new TypeError("Cannot convert undefined or null to object");
                var s = l && i;
                if (a && n.length > 0 && !e.call(n, 0))
                    for (var y = 0; y < n.length; ++y) p.push(String(y));
                if (u && n.length > 0)
                    for (var g = 0; g < n.length; ++g) p.push(String(g));
                else
                    for (var h in n) s && "prototype" === h || !e.call(n, h) || p.push(String(h));
                if (o)
                    for (var w = f(n), d = 0; d < c.length; ++d) w && "constructor" === c[d] || !e.call(n, c[d]) || p.push(c[d]);
                return p
            }
        }());
    }

    function EnumerableOwnProperties(e, r) {
        for (var t = Object.keys(e), n = [], s = t.length, a = 0; a < s; a++) {
            var i = t[a];
            if ("string" === Type(i)) {
                var u = Object.getOwnPropertyDescriptor(e, i);
                if (u && u.enumerable)
                    if ("key" === r) n.push(i);
                    else {
                        var p = Get(e, i);
                        if ("value" === r) n.push(p);
                        else {
                            var f = [i, p];
                            n.push(f)
                        }
                    }
            }
        }
        return n
    }
    if (!("entries" in Object)) {
        ! function() {
            var e = {}.toString,
                t = "".split;
            CreateMethodProperty(Object, "entries", function r(n) {
                var i = ToObject(n);
                return i = ("string" === Type(i) || i instanceof String) && "[object String]" == e.call(n) ? t.call(n, "") : Object(n), EnumerableOwnProperties(i, "key+value")
            })
        }();
    }
    if (!("values" in Object)) {
        ! function() {
            var t = {}.toString,
                e = "".split;
            CreateMethodProperty(Object, "values", function r(n) {
                var c = "[object String]" == t.call(n) ? e.call(n, "") : ToObject(n);
                return Object.keys(c).map(function(t) {
                    return c[t]
                })
            })
        }();
    }
})('object' === typeof window && window || 'object' === typeof self && self || 'object' === typeof global && global || {});`,
`window.__twilightSettings = {
    "environment": "production",
    "account_checkup_m2": [1, true],
    "account_checkup_m3": [0.2, true],
    "acommand_enabled": true,
    "active_gift_promo_offer_feature_flag": [1, true],
    "activity_feed_qa_ff": [1, true],
    "ad_content_metadata_allowlist": ["155668964", "38543271", "25100025", "24199752", "472905796", "452977866"],
    "ad_content_metadata_rollout": [1, false],
    "additional_animated_emote_templates": [0, false],
    "additional_recurly_supported_countries": [],
    "ads_bonus_enabled": [0, false],
    "ads_bonus_end_date": "2021-12-31T08:00:00Z",
    "ads_bonus_start_date": "2021-11-01T07:00:00Z",
    "affiliate_emoticon_prefix_update": [1, true],
    "affiliate_revenue_share_banner": [1, false],
    "alert_settings_modal": [1, true],
    "Allowed_OMSDK_vendors_in_Twilight": ["IAS", "doubleverify.com-omid", "amazon.com-omid", "iabtechlab.com-omid"],
    "am_ccar_feature_enabled": [1, true],
    "amazon_ads_url": "https://s.amazon-adsystem.com/iui3?d=3p-hbg&ex-src=twitch.tv&ex-hargs=v%3D1.0%3Bc%3D8858214122683%3Bp%3De75425fb-5407-7bd5-fd20-f462e98a8777",
    "amazon_ads_url_crown_uk": "https://aax-eu.amazon-adsystem.com/s/iui3?d=forester-did&ex-fargs=%3Fid%3Db8b26227-de81-5bfb-4046-b9158f6a8c08%26type%3D4%26m%3D3&ex-fch=416613&ex-src=https://www.twitch.tv&ex-hargs=v%3D1.0%3Bc%3D3815840130302%3Bp%3DB8B26227-DE81-5BFB-4046-B9158F6A8C08",
    "amazon_ads_url_crown_us": "https://s.amazon-adsystem.com/iui3?d=forester-did&ex-fargs=%3Fid%3D2d452222-ea0d-0b73-d0cc-472923e63141%26type%3D4%26m%3D1&ex-fch=416613&ex-src=https://www.twitch.tv&ex-hargs=v%3D1.0%3Bc%3D7416603020101%3Bp%3D2D452222-EA0D-0B73-D0CC-472923E63141",
    "amazon_ads_url_prime_page_uk": "https://aax-eu.amazon-adsystem.com/s/iui3?d=forester-did&ex-fargs=%3Fid%3D5b59d365-e0b2-268d-00a0-aa0f59cce0c1%26type%3D4%26m%3D3&ex-fch=416613&ex-src=https://www.twitch.tv/&ex-hargs=v%3D1.0%3Bc%3D3815840130302%3Bp%3D5B59D365-E0B2-268D-00A0-AA0F59CCE0C1",
    "amazon_ads_url_prime_page_us": "https://s.amazon-adsystem.com/iui3?d=forester-did&ex-fargs=%3Fid%3D573a4bd9-f106-f600-a392-699ceaddb160%26type%3D6%26m%3D1&ex-fch=416613&ex-src=https://www.twitch.tv/prime&ex-hargs=v%3D1.0%3Bc%3D7416603020101%3Bp%3D573A4BD9-F106-F600-A392-699CEADDB160",
    "amazon_advertising_pixel": "https://s.amazon-adsystem.com/iu3?pid=49226e71-48b6-4ccb-bf4c-f82acb404220",
    "amazon_pay_enabled": [1, true],
    "amv2_phase_2": [1, true],
    "amv2_phase_2_ccp": [1, false],
    "analytics_rare_candy": [0, false],
    "analytics_rare_candy_stubbed": "stub",
    "ani_emote_dash": [1, false],
    "animated_emotes_vx": [1, false],
    "announce_collaboration_widget": "on",
    "artist-alley-feature": [1, false],
    "ask_clint_or_ryan": false,
    "audio_ad_experiment_duration_bounds": [30, 90],
    "audio_ad_experiment_percentage": [0, false],
    "audio_maf_web": [1, true],
    "automod_ally_switchover": [1, false],
    "automod_ally_test_feature": [0, false],
    "badge_flair_enabled": true,
    "badge_flair_overrides": ["436929429", "58682589", "467487002", "467832116", "28337972", "409749393", "193141706", "509785842"],
    "badge_modifier_channels": [],
    "badge_modifier_help_link": "https://help.twitch.tv/s/article/subscriber-badge-guide#badgeflair",
    "badge_modifier_start_date": "2020-02-06T22:00:00.75536206Z",
    "badge_modifiers": ["gold", "silver"],
    "banned_chat_connection": true,
    "bans_sharing_feature_is_new": true,
    "bans_sharing_info_privileged_users_only_rollout": [1, true],
    "bans_sharing_info_rollout": [0, false],
    "bans_sharing_rollout_enabled": false,
    "bda_ad_edge_web": [0, true],
    "bits_badge_settings_v2": [1, false],
    "bits_badge_tier_notification": [1, false],
    "bits_charity_event": "off",
    "bits_prime_offer": false,
    "bits_project_marley": [1, true],
    "bits_project_stucco_dashboard": [0, false],
    "bits_sponsored_cheermote_dashboard_settings": "off",
    "bits_sponsored_cheermotes": "on",
    "bits_sponsored_cheermotes_announcement": "off",
    "bits_usage_history": [1, false],
    "bits_world_cup_event": false,
    "bits_world_cup_event_phase_2": false,
    "bounty_board_available_bounties_date": "Wed June 27 2018 00:00:00 GMT-0700 (PDT)",
    "bounty_board_brand_portal_internationalization_enabled": [1, true],
    "bounty_board_brand_portal_trailer_enabled": [1, true],
    "bounty_board_chat_cta_enabled": [1, true],
    "bounty_board_live_dashboard_widget": "on",
    "bounty_board_promotions_enabled": [1, true],
    "c2_cel_exp": [0, false],
    "c2_cel_exp_participants": [""],
    "c2_cel_ux_exp_survey_link": "https://twitchtv.az1.qualtrics.com/jfe/form/SV_6g983xsfyJoU4Zg",
    "c2_learn_more": "https://twitch.uservoice.com/forums/921826/suggestions/43388733",
    "c2_message_size": [0, false],
    "c2_message_size_participants": [""],
    "c2_message_size_ux_exp_survey_link": "https://twitchtv.az1.qualtrics.com/jfe/form/SV_4ZuHnB79TByKEJM",
    "c2_midnight_squid": true,
    "c2_screenshot": [0, false],
    "c2_screenshot_participants": [""],
    "c2_screenshot_ux_exp_survey_link": "https://twitchtv.az1.qualtrics.com/jfe/form/SV_1GNQvj2mPWLt41M",
    "c3x_vod_collections_migr_hours": 0,
    "c3x_vod_collections_migr_state": "off",
    "c3x_vod_collections_migr_timestamp": 0,
    "cc_v2_pov_selector": ["overwatchleague", "overwatchleague_ru", "overwatchleague_fr", "overwatchleague_br", "overwatchleague_kr", "maybe_ill_be_tracer"],
    "cc_v2_single_stream": ["overwatchleague", "overwatchleague_ru", "overwatchleague_fr", "overwatchleague_br", "overwatchleague_kr", "maybe_ill_be_tracer"],
    "cc_v2_whitelist": ["cpt_meticulous_test-staff", "faceittv", "genvid_csgo1test", "genvid_csgo4test", "genvid_csgo5test", "genvid_csgo6test", "maybe_ill_be_tracer-staff", "maybe_ill_be_tracer2", "maybe_ill_be_tracer3-staff", "starladder_cs_en", "starladder5-staff", "starladder10-staff", "starladder_cs_en2-staff", "twitchmusic", "switchott", "shawtest-staff", "ee_cc_ez", "partymobile", "streamkeychanges", "nba2kleague", "nba2kleague1", "nba2kleague2-staff", "vapourdev-staff", "twitch", "twitchpresents", "twitchgaming", "retroitcity", "cdtest1", "mekapika-staff", "crown", "crown_purple", "crown_teal", "crown_emerald", "twitchrivals", "twitchrivals_es", "twitchrivals_fr", "twitchrivals_de", "twitchrivals_it", "twitchrivals_pt", "twitchrivals_kr", "twitchrivals_th", "twitchrivals_jp", "twitchrivals_tw", "twitchrivals_uk", "twitchrivals_pl", "fcftest1-staff", "fcftest2-staff", "fcf", "anshr-staff", "karlaplan", "deiv84", "nicolais86", "taaltest", "grablabsttv", "notgambling", "blastheroes", "chess", "chesscomevents", "chess24", "00101011011011010", "dmr_test", "mlex_multiview", "esl_test1", "esl_csgoc", "esl_csgo", "limelight_dev", "qa_asd_partner", "crown_magenta", "crown_teal", "EASPORTSFIFA", "EACGEFIFA", "iamcristinini", "twitch_platforms_mview", "abulic", "riotgames", "legofan1994", "playapex", "eamaddennfl-staff", "cpt_meticulous", "spontent-staff", "espontent-staff"],
    "celebi_animation_settings": "{}",
    "celebi_beta_channels": ["seph"],
    "celebi_celebration_area": "EVERYWHERE",
    "celebi_stream_delay": true,
    "census-affiliate-onboarding-modal-enabled": [0, false],
    "cep_enabled": [0, false],
    "cf_allow_editors_on_clips_manager": [1, false],
    "cf_allow_staff_on_clips_manager": [1, false],
    "cf_clip_title_maintenance": false,
    "cf_do_you_like_tuna": [1, true],
    "cf_goals_customizations_color": [1, false],
    "cf_goals_subs_dropdown": [1, true],
    "cf_jim_breaks_the_fourth_wall": [1, true],
    "cf_jim_faxes_from_the_future": 1000,
    "cf_jim_yellow_sub_marine": [1, true],
    "cf_premieres_sunset": true,
    "cf_scotts_tots": [1, true],
    "cf_secret_agent_big_tuna_2": [1, true],
    "cf_sunset_reruns_announce": false,
    "cf_terms_allowlist": ["197886470", "94753024", "25385874"],
    "cf_tourney_cep_format_killswitch": [0, false],
    "cf_v2_collections_gql": [1, true],
    "cf_v2_edit_video_modal_gql": [1, false],
    "cf_v2_update_video_gql": [0, false],
    "cf_video_chat_sunset": true,
    "cf_video_manager_to_gql": [0, true],
    "cf_wp_disable_automatic_muting": [1, true],
    "cf_wp_force_broadly_viewable": [0, false],
    "cf_wp_hackathon": [0, false],
    "cf_wp_m3_badging": [0, false],
    "cf_wp_m3_creator_badging": [1, true],
    "cf_wp_m3_enable_chat": [1, false],
    "cf_wp_m3_qa_affiliates": [1, false],
    "cf_wp_m3_qa_ga": [1, true],
    "cf_wp_m3_qa_partners": [1, true],
    "cf_wp_m3_search_catalog": [1, true],
    "cf_wp_m4_channel_page_integration": [1, true],
    "cf_wp_retry_count": 3,
    "cg_sku_presentment_part2": true,
    "cg_tools_creator_goals_card": [0, false],
    "change_payout_method_reauth_required": true,
    "channel_banned_alias_enabled": [0, false],
    "channel_clips_feature": [1, true],
    "channel_feed_enabled": false,
    "chat_filter_enabled": "on",
    "chat_filter_start": "2019-01-18T21:49:42.699Z",
    "chat_globalaccelerator_pct": 1.0,
    "chat_history": [1, true],
    "chat_input_box_followers_only_restriction_enabled": "on",
    "chat_input_box_slow_mode_restriction_enabled": "on",
    "chat_input_box_verified_only_restriction_enabled": "on",
    "chat_replies_m2a": [1, true],
    "chat_replies_m2b": [1, true],
    "chat_send_message_refactor": [0, false],
    "chat_slow_mode_banner": [1, false],
    "chat_timing_heartbeat_ms": 60000,
    "Cheer_2_UX_Survey_Link": "https://www.twitch.tv/",
    "cip_discoverability_channel_analytics": [1, false],
    "client_availability_reporting": [0.1, true],
    "Clip_Snip_General_Rollout": [1, false],
    "Clip_Snip_Partner_Rollout": [1, false],
    "Clip_Snip_Retry_Days": 1,
    "cmon_chat_introduction": [1, false],
    "code_redemption_redeem_page": "on",
    "colosseum": ["qa_bits_partner", "116076154", "johnnybanana5", "529270304", "seph", "108707191", "qa_slaye_affiliate", "265943326"],
    "commerce_bar_experience": "sponsored",
    "community-moments-rollout": [1, false],
    "community_boost_enabled": [0, false],
    "community_moments_jitter_range_seconds": 0,
    "community_moments_quick_action_new_date": "2022-02-08T19:00:00Z",
    "community_sub_gifting_banner_timeouts": [0, 25, 35, 45, 55, 60, 60],
    "consent_banner_headline_rollout": [0, true],
    "consent_dismiss_button_rollout": [1, true],
    "consent_enabled": [1, false],
    "consent_modal_tldr": [1, true],
    "consolidated_dashboard_settings": "on",
    "content_promo": [0, false],
    "cookie_consent_rollout": [1, true],
    "copo_challenges_count": 3,
    "copo_mod_participation": [1, true],
    "copo_shorter_predictions": [1, true],
    "copo_spectator_mode": [1, true],
    "copyright_complaint_form_enabled": true,
    "copyright_complaint_form_user_allowlist": ["518822316", "514236910", "490177374", "514820819", "191943869", "554342166", "134901385", "225435142"],
    "creative_vert": [1, false],
    "creator_anniversaries_enabled": [0, false],
    "creator_camp_launch": "all",
    "creator_chat_highlights": [1, false],
    "creator_dashboard_search": [0, false],
    "creator_defined_benefits": true,
    "creator_goals_changelog_date": "2021-08-25 00:00:00 GMT-0700",
    "creator_incentive_enabled": [1, false],
    "creatorhome_goals_experiment_mock_component_v2": [0, false],
    "creatorhome_new_affiliates_cluster_query": [1, false],
    "creatorhome_new_affiliates_home": [1, false],
    "crowd_chant": [0, false],
    "crowd_chant_length_limit": 120,
    "crowd_chant_query": [0, false],
    "CSI_use_xo_actions": true,
    "custom_event_destination_threshold": true,
    "da_manager_m2": [1, false],
    "dashboard_moderation_settings_enabled": true,
    "dashboard_payout_history": true,
    "dashboard_payout_incentives": "on",
    "dashboard_prime_earnings": "on",
    "dashboard_prime_earnings_new_copy": "off",
    "dashboard_vp_widget_enabled": true,
    "Default_Emote_Library": [1, false],
    "delete_mod_actions_enabled": [1, false],
    "deprecate_friends": false,
    "dev_console_nav_update": [0, false],
    "dev_drops_campaign_status_bar_doc": "https://dev.twitch.tv/docs/drops/",
    "dev_drops_campaign_viewer_preview_enabled": false,
    "dev_drops_M1_launch_doc": "https://discuss.dev.twitch.tv/t/were-dropping-a-new-update-to-drops-campaign-management/25079",
    "dev_drops_V2_launch_doc": "https://blog.twitch.tv/2020/08/18/available-today-a-new-version-of-drops/",
    "dev_enable_drops_v2_console": true,
    "dev_extensions_migrate": "on",
    "dev_video_extension_redesign_full_switch": true,
    "dev_video_extension_redesign_notification": true,
    "dev_video_extension_redesign_testing_env_available": true,
    "directory_page_upcoming_schedules": [1, true],
    "disable_multiview_load": false,
    "disable_payout_balance": false,
    "disable_pr_for_mr": [1, false],
    "disable_preroll_overlay": [1, false],
    "DMCA_Clips_Manager_Hint": [1, true],
    "DMCA_Copyright_Claims_Page": [1, true],
    "DMCA_Mock_Copyright_Claims_Page": [0, false],
    "DMCA_Persistent_Banner_Hint": [1, false],
    "drops_10_devsite_decommission": true,
    "drops_2_time_based_ui_enabled": true,
    "drops_2_ui_enabled": true,
    "drops_2_user_whitelist": ["25009227", "miri", "cam", "skeltonath", "oroga", "ampt", "butterk2", "rileyjar", "ocean__floor", "cnepetertest", "cnegames", "pennyarcade", "VektorTa", "massiccia", "cicciamassiccia", "ciccia", "new_drops_tester", "cnepetertestviewer", "cado", "overseer_alpha_test", "angela_", "solidsnackdrive", "cnepeter", "CNE_Shawn", "cne_margaret", "levelplane", "CNEMark", "miritest1"],
    "drops_event_based": [0, false],
    "drops_itemnames_enabled": true,
    "edit_broadcast_poll_interval_ms": 60000,
    "embed_upsell_hover_time_after_first_upsell": 30,
    "embed_upsell_preview_duration_sec": 180,
    "emote_card": "on",
    "Emote_Card_Octane": [1, true],
    "emote_card_whitelist": ["184009112"],
    "emote_picker_load_bits_tier_emotes": [1, true],
    "enable_async_giftcard_redemption": [1, true],
    "enable_category_suggestion_cluster": true,
    "enable_desktop_app_sunset_banner": [1, true],
    "enable_localized_twitch_music_link": false,
    "enable_vod_tool_cluster": true,
    "eu_direct_debit_allowlist": ["419474736", "499126710", "719587951", "600585984"],
    "eu_direct_debit_valid_schemes": ["BACS", "SEPA"],
    "eu_respawn_enabled": "on",
    "event_directory_enabled_games": [],
    "events_deprecation_date": "2019-11-12T23:59:59Z",
    "events_deprecation_notice_enabled": true,
    "expStaff_upcoming_schedules_directory_page": "active",
    "expStaff_vx_vert": "variant1",
    "ext_challenges_whitelist": ["wlisor7an1m544ki2r9i1usl4d5ul0", "a9e46yl7gqwlsz7q6fqdqnrxng7tau", "ltszuxapi6b0wfpde6vqe2rodth4c5", "kd1b92hzrraf5k3uidm0a1u4fhrp6o", "8skl5ohvxvl8deeejox1e1fh7ovunh", "0vzjxlrppvwz5vzhfqwanqmka2g01l", "qxxw3ujo98hs4szinbwt59m94d9ozo"],
    "ext_sub_to_channel_whitelist": ["a5qgosum7si05cdwematgg2ozjtaq2", "18mdz6bwjda5he7bfsae6h91lgxgdw", "eavqdqcqgwud2gyqcnq9iix4t59j4k", "fr22g90tzrvi91eevh5ipehxbko7gd", "a49eq2cvncnt5n7eg2q6rhevadaz0p", "pt33xuskm584dpxkqnjs35zlkp406d", "vk1a7ieh6mgb3amd1gh81zvmdqcz0m", "d1dp7kdgsq3yg4ddyyel9mz5jebvoo", "xab8h6nj36fc2wtn71yikw9hqjd6v4", "a3gn4obyt6uzyu047scc9jfj7qneau", "fvynlr29tr76g9db18rjes5ptjklm7", "38v1o52q1c2qja1lfr73uid3r5rj8u", "c1kymnzual4uue80v72xt3qwn4a0k0", "5lauckksixlu987b5kbpuul70zqxdz", "oafn7vvzfyzyccwrwrt233221oe5wq", "xptj7dr0lk3xri8fkjot9w7n36zv12", "7nydnrue11053qmjc6g0fd6einj75p", "0btmbqa5tm2pyr0f59td8vk1unwxl6", "vsx7jb2l8d921dwr7b1qdrazuup2zk", "8z7rppiou6n4jf4sdjdz5sycrk0nvo", "07kczqwdkjxw6la4j92crc5wyumjxa"],
    "ext_use_sub_to_channel_whitelist": true,
    "extension_content_recommendations": [1, true],
    "extension_discovery_redesign": [0, true],
    "extension_panel_recommendations": [1, true],
    "extension_ratings_download": [1, true],
    "extension_review_maintenance": [0, false],
    "extensions_dynamic_management": [1, true],
    "extensions_gql_migration": [1, true],
    "extensions_popout_enabled": "on",
    "fb_login_support_campaign_end_date": "2021-09-30T23:59:59Z",
    "fb_login_support_campaign_start_date": "2020-03-03T00:00:00Z",
    "fb_tog_enb": [1, true],
    "fft_v1": [0, true],
    "fft_v1_sf": [0, false],
    "first_paid_gift_offer_feature_flag": [1, true],
    "follower_emotes_launch": [1, true],
    "freeway_extension_ids": ["4ced1fygnrzerfs95cofbwiltq88uh", "fr22g90tzrvi91eevh5ipehxbko7gd"],
    "friend_writes_disabled": [0, false],
    "giftcard_currency_expansion": [1, true],
    "graphql_result_proxy_rollout": [0.01, false],
    "heartbreak_allowed": ["tehmorag", "norbro86", "meadowfox", "jimorian", "starflame", "guru", "jcog", "twiggie", "demoncatdaphne", "hearthvalley", "studingo", "finamenon", "skee", "twrongnotwright", "qa_long_partner", "modularseattle", "vicksy", "fgsquared", "ferretbomb", "dracon", "tomshi", "nayfal", "indeedee", "skynyx", "lothar", "snowlit", "fruitbats", "catalystz", "xocliw", "mshoboslayer", "bekyamon", "tugboet", "thesilvergauntlets", "kristikates", "loctavian", "2dkiri", "monado", "guddah", "slevinthheaven", "mathulu", "magnetron", "lotharhs", "fm_guru", "emray", "jenericlive", "matrixis"],
    "hide_feedback_on_promoted_card": false,
    "hide_redundant_payment_methods_opt_out": ["175400772", "109091935"],
    "host_commands_rollout_v2": [1, false],
    "hype_train_colors_enabled": true,
    "hype_train_customization_enabled": [1, false],
    "hype_train_personalized_settings_allowlist_key": ["499158006"],
    "hype_train_personalized_settings_enabled": true,
    "ignore_mismatch": true,
    "ignored_logger_error_dependencies": [],
    "include_chat_timing_nonce": true,
    "intl_pricing_promo_balloon_countries": ["TR", "MX", "AU", "AZ", "BD", "BN", "BT", "CN", "FJ", "FM", "HK", "ID", "IN", "KG", "KH", "KI", "KR", "LA", "LK", "MH", "MN", "MO", "MV", "MY", "NC", "NP", "NR", "NZ", "PF", "PG", "PH", "PK", "PW", "SB", "SG", "TH", "TJ", "TL", "TM", "TO", "TV", "TW", "UZ", "VN", "VU", "WS", "BR", "AR", "BB", "BO", "CL", "CO", "CR", "DO", "EC", "SV", "GT", "HN", "NI", "PA", "PY", "PE", "UY", "AG", "AW", "BS", "BZ", "KY", "CW", "DM", "GD", "GY", "HT", "JM", "KN", "LC", "VC", "SR", "TT", "VE", "AE", "AF", "AO", "BF", "BH", "BI", "BJ", "BW", "CF", "CG", "CM", "CV", "DJ", "DZ", "EG", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "JO", "KE", "KM", "KW", "KZ", "LB", "LS", "LY", "MA", "MG", "MK", "ML", "MR", "MU", "MW", "MZ", "NA", "NE", "NG", "OM", "QA", "RW", "SA", "SC", "SL", "SN", "SO", "SS", "ST", "SZ", "TD", "TG", "TN", "TZ", "UG", "YE", "ZA", "ZM", "AL", "AM", "AT", "BA", "BE", "BG", "BY", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GE", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MD", "ME", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SK", "SM", "UA"],
    "intl_pricing_promo_balloon_end_date": "2021-11-03T13:00:00Z",
    "intl_pricing_promo_balloon_start_date": "2021-05-20T20:00:00Z",
    "is_grogu_enabled": [0, false],
    "is_legacy_dashboard_enabled": true,
    "is_nami_enabled": [1, true],
    "is_nami_international_enabled": [1, true],
    "is_zuko_enabled": [1, true],
    "launch_pad": "{\"sv\":\"https://twitchtv.az1.qualtrics.com/jfe/form/SV_agjOSjZcGCGcunc\",\"svd\":30,\"lm\":\"https://help.twitch.tv/s/article/boost-experiment\",\"u\":1000,\"ls\":[1,3,5]}",
    "launch_pad_ready": [0, false],
    "left_nav_polling_interval_ms": 300000,
    "longtask_tracking_sample_rate": 0.1,
    "low_trust_users_rollout_enabled": false,
    "ltu_widget_rollout_date": "2021-11-30T20:15:50.963Z",
    "mac_studio_downloads_enabled": true,
    "mads_enabled": [1, true],
    "mads_polls_dashboard_enabled": [1, true],
    "mads_polls_no_auto_minimize": [1, true],
    "mads_polls_ui_enabled": [1, true],
    "mads_settings_toggle_enabled": [1, true],
    "mads_snackbar_enabled": [1, false],
    "mads_turbo_subs_banner": [0, true],
    "mafs_prevent_duplicate_triggers": [1, false],
    "mastercard_experiment": true,
    "mastercard_experiment_end_date": "2022-05-31T23:59:59Z",
    "mastercard_experiment_expiry_date": "2022-12-31T00:00:00Z",
    "mastercard_experiment_start_date": "2022-05-03T00:00:00Z",
    "megacommerce_holiday_2020_part1_end_date": "2020-12-16 13:59:59 GMT-0800",
    "megacommerce_holiday_2020_part1_start_date": "2020-12-02 14:00:00 GMT-0800",
    "megacommerce_holiday_2020_part2_end_date": "2021-01-04 13:59:59 GMT-0800",
    "megacommerce_holiday_2020_part2_start_date": "2020-12-16 14:00:00 GMT-0800",
    "megacommerce_kpop_end_date": "2020-10-31T06:59:59Z",
    "megacommerce_kpop_start_date": "2020-10-19T21:00:00Z",
    "membrane_channel": "",
    "membrane_channels": "[{\"login\": \"sykkuno\", \"end\": \"2022-06-01T00:00:00Z\"}]",
    "messages_disclosure_enabled": false,
    "mobile_phone_verification_enabled": [0, false],
    "modal_layer_menu_enabled": [1, false],
    "mods_author_subscription": [1, false],
    "mods_goodbye_takeover": true,
    "motivation_lvf_flag": [1, false],
    "multi_month_gifting": true,
    "music_follow_feature_allowlist": ["603146961", "735667497", "738912536", "156488576", "749283987", "108122248", "206339667", "220439537", "702882417", "533276397"],
    "music_portal_access": [0, true],
    "native_account_recovery": "on",
    "native_broadcast_blacklist": [],
    "native_not_me": "on",
    "netherlands_merch_link_reroute": [1, true],
    "new_device_login_digit_only": true,
    "new_live_announcements": true,
    "new_me_command": [1, false],
    "new_password_message": [0, true],
    "nfl_channels": ["cctester33", "stevemz"],
    "nfl_game_id": "14017",
    "No_Track_Pages": ["/user/password-reset"],
    "notification_app_server_public_key": "BGzteaQYOqrTAPN8EuuowBVG67pHwyZo879XZkC7cUV2QP4qQf-92Pmm9tyOuriJdiKnMDDRi28F5HQK6uSk0vM",
    "offer_claim_sync": [0, false],
    "omsdk_domain_allowlist_in_Twilight": ["ddacn6pr5v0tl.cloudfront.net", "c.amazon-adsystem.com", "www.twitch.tv"],
    "one_click_checkout_blocklist": ["86137825"],
    "one_click_checkout_country_allowlist": ["US"],
    "one_click_checkout_country_block_list": ["KR"],
    "one_click_checkout_eu_country_allowlist": ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"],
    "one_click_checkout_v2_country_allowlist": ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "US", "BR", "AU", "KR"],
    "p_by_p_adstart_show_player": [1, true],
    "p_by_p_gate": [1, true],
    "pay_mambo": [1, true],
    "payment_methods_migration": [0, false],
    "payments_recurly_countries": ["US", "FI", "ES", "IE", "SK", "RO", "CA", "GB", "AT", "BG", "HR", "CZ", "DK", "EE", "FR", "DE", "HU", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "SI", "SE", "BE", "GR", "CY"],
    "payments_spm_enabled_countries": ["US", "CA", "AT", "BE", "BG", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "GR", "CY"],
    "payout_transparency": [1, true],
    "payout_transparency_v2_active": [1, true],
    "paypal_enabled": [1, true],
    "paypal_eu_subs": true,
    "persisted_queries_enabled": true,
    "personalized_sub_modal_phase_one": true,
    "phase_one_game_migration": [1, true],
    "phase_two_game_migration": [1, true],
    "phone_number_signup_settings": [1, false],
    "pm_b_auto_r": [1, true],
    "poliwag_rollout": [1, true],
    "premiere_video_manager_public": true,
    "premiere_video_manager_staff": true,
    "prime-crown-hidden-ids": ["d2b3cfee-0031-9cec-bed6-68f17f063bea", "0eb3cfd9-2b0e-7fd6-860a-e77acbefc59b", "a8b3cfef-a3a6-a10a-028e-a3667745cf6e", "a8b3cf95-3d31-8928-fcac-4be714ed4f8b", "2eb3cfe0-5183-50e2-87ff-337f6395b742", "aeb3cfd6-cc37-b3be-cccd-bb4140eb519a", "46b3e982-28a3-241e-9a59-c3223acfb62a", "58b3e983-fa1a-3464-9364-43410fba3ec3", "84b3e97f-5539-2da2-7ad7-5a03f40d9535", "eab3e985-44c4-4c5a-1fab-0fe27d4fde4a", "b0b3e98e-89f2-84ef-0faf-259736fdb7f1", "94b44d55-bdb7-ea3b-981d-4e8e28ad764b", "32b44b56-38a9-ddc3-486c-c7c073bacb9f", "20b44d5c-6d94-eee1-7f5d-e3c5baa5cd67"],
    "prime-free-offer-ids": [],
    "prime-gifting-whitelist": ["solidfps", "hexy", "streamerhouse", "datmodz", "macho", "schviftyfive", "inigomontoya", "xtony_t_x", "angryjoeshow", "harrisheller", "kasrram", "qa_prime_partner_1", "qa_cx_tp_080616580000"],
    "prime-loot-page-hidden-ids": ["d2b3cfee-0031-9cec-bed6-68f17f063bea", "0eb3cfd9-2b0e-7fd6-860a-e77acbefc59b", "a8b3cfef-a3a6-a10a-028e-a3667745cf6e", "a8b3cf95-3d31-8928-fcac-4be714ed4f8b", "2eb3cfe0-5183-50e2-87ff-337f6395b742", "aeb3cfd6-cc37-b3be-cccd-bb4140eb519a", "46b3e982-28a3-241e-9a59-c3223acfb62a", "58b3e983-fa1a-3464-9364-43410fba3ec3", "84b3e97f-5539-2da2-7ad7-5a03f40d9535", "eab3e985-44c4-4c5a-1fab-0fe27d4fde4a", "b0b3e98e-89f2-84ef-0faf-259736fdb7f1", "94b44d55-bdb7-ea3b-981d-4e8e28ad764b", "32b44b56-38a9-ddc3-486c-c7c073bacb9f", "20b44d5c-6d94-eee1-7f5d-e3c5baa5cd67"],
    "prime_2_paid": "on",
    "prime_blocked_regions": ["IN", "IND", "CU", "CUB", "SD", "SUD", "IR", "IRN", "CHN", "CN", "SY", "SYR", "PRK", "KP", "RU", "RUS", "BY", "BLR"],
    "prime_gift_experiment_offer_ids": ["66b38719-794e-2aa7-9ce6-66690ef4f6aa", "34b38f7c-55f8-fbc6-e2b1-1d23987cf594", "8ab38ee7-ad80-a88c-dfe9-aef78c980fde", "acb38f7b-c3f2-307c-2017-c4f3a6acd402"],
    "prime_landing_page_base_url": "https://twitch.amazon.com/prime/country",
    "prime_loot_top_offer_list": "Game",
    "prime_page_redirect": [0, false],
    "prime_promo_content_base_url": "https://twitch.amazon.com/prime",
    "prime_sub_blocked_regions": ["IN"],
    "prime_subsite_up": true,
    "prism-endpoint-migration": [0, false],
    "project_airhorn": [0, false],
    "promotions_boost_challenges_viewer": [1, true],
    "promotions_boost_settings": [1, true],
    "promotions_boost_viewer": [1, true],
    "promotions_live_recommended_shelf_enabled": [1, true],
    "Promotions_Sidenav_Feature_Flag": [1, false],
    "promotions_sidenav_recommended_enabled": [0, true],
    "prowse_enabled": true,
    "quick_actions_sanitization_check": [1, false],
    "radio-track-promotion-v0": [1, true],
    "radio_add_tracks_soundtrack_playlist": [1, true],
    "radio_create_soundtrack_playlist": [1, true],
    "radio_delete_soundtrack_playlist": [1, true],
    "radio_duplicate_soundtrack_playlist": [1, true],
    "radio_fetch_soundtrack_playlist": [1, true],
    "radio_fetch_soundtrack_playlists": [1, true],
    "radio_fetch_soundtrack_tracks": [1, true],
    "radio_move_tracks_soundtrack_playlist": [1, true],
    "radio_remove_tracks_soundtrack_playlist": [1, true],
    "radio_soundtrack_account_link_feature_flag": [1, true],
    "radio_soundtrack_cms_allowlist": ["88943708", "590199303", "265990473", "729044060"],
    "radio_soundtrack_cms_feature_flag": [0, true],
    "radio_soundtrack_ugc_feature_flag": [0, true],
    "radio_update_soundtrack_playlist": [1, true],
    "raid_commands_rollout_v2": [1, true],
    "raids_use_legacy_api": false,
    "recurly_cc_disabled_countries": [],
    "recurly_enabled": [1, true],
    "recurly_spm_guard": [1, true],
    "recurly_tax_enabled": "true",
    "redeem_page_zip_code_required_countries": ["US", "CA"],
    "revenue_dashboard_hype_train": true,
    "revenue_leaderboards": true,
    "rocket_train_passengers": ["408380599", "478863946", "695413795"],
    "rocket_train_ready": [1, false],
    "rocket_wheels_help_article": "https://help.twitch.tv/s/article/boost-train",
    "rocketeers": ["478863946", "522361307", "167136666", "531221714", "728717540", "129802180", "63664393", "408380599"],
    "ronaldo_creators_enabled": [1, false],
    "ronaldo_enabled": [1, false],
    "rooms_deprecation_enabled": true,
    "rooms_deprecation_notice": true,
    "rooms_deprecation_selector_hidden": true,
    "ruby_is_the_cutest_dog_ever": "off",
    "safety_center_feature_flag": [1, false],
    "Sandboxed_OMSDK_vendors_in_Twilight": ["IAS", "amazon.com-omid"],
    "sda_ad_edge_web": [1, true],
    "sda_broadcaster_allowlist": ["25525699", "51898091", "53831996", "76446919", "142679750", "95864871", "30923466", "36470829", "675126186", "712724109"],
    "sda_broadcaster_allowlist_enabled": false,
    "sda_lowerthird_web": [1, true],
    "sda_lshape_web": [0, true],
    "sda_suppress_flag": [1, true],
    "search_debounce_timeout_ms": 50,
    "search_tracking_enabled": true,
    "seatbelt_rollout": [1, true],
    "should_extensions_check_google_analytics_consent": true,
    "show_me_the_money": [1, false],
    "shuffle_panel_extension_recommendations": [1, false],
    "sizmek_versatag_channels": ["riotgames", "tekken", "rocketleague"],
    "sizmek_versatag_events": ["YeUmkUI9R5GKR5WGtg046A", "f4aK8duASJKiAYAiETsUvw", "WN1Ly4NxRgOrSNWOSG40PQ", "YFCU_dppR6Oor32XLPrU2w", "2HsLVRMUTnqChbVy5YSsfg", "f4aK8duASJKiAYAiETsUvw"],
    "sizmek_versatag_games": ["496712", "Call of Duty: WWII", "497571", "Wrestling"],
    "sizmek_versatag_teams": ["wrestling"],
    "sl_exp": 0,
    "smgr_remove_view_count": [1, false],
    "soft_landing_flag": [1, true],
    "sol_sticker_ids": ["c22bdbea-f4f9-40b4-9f01-bd6f702a37f8", "a5eccd44-df34-4f3b-a330-59a3b3c86fa6", "080015ad-6e38-49b1-982a-57048244f7a8"],
    "sol_super_mutators": ["ccm_test", "tw_pa_kauh", "specialbigpanda", "qa_partner2", "diedragondie", "starladder_cs_en", "nagzz21", "leyley", "farrell___", "reeveski", "impactwrestling", "seekaysee", "jacklifear", "doubletoasted", "cellbit", "qa_asd_partner"],
    "soundtrack-playlist-promo": true,
    "soundtrack_content_promo_v1": true,
    "spade_url": "https://video-edge-530ed1.pdx01.abs.hls.ttvnw.net/v1/segment/Crn10hJqOmOUabPZuYGHTasbBpbym-GwLm2DYp2QSBMUj75O1m7tx2rEPhkA9rZc5mPu28cP4ovbBsMrA6dbsq7m0bYpHIOpXoehHHCLiPgohGiZvhxNb24JOPTtp4u8NEpDDHZ-aLgeAawKxOliTwkll0HVbUrVDtMPZkf05q0LtL8Kq5X5W5C95hb-9B0e6zSsTb0HyO2JaYfhQbyyNN88Lomzse8sxUS-pO2hbkcaCpFDv8af1-DidL_PiD6Su6EcXXRuzt-o7votFzlImJbnja-E_UynKEzZklQ2OoR7RihKN6Tv-LIKNjnPNHfvfkQ8JUbO37xr7-11LRwAt7xi6yvUmgtdQW0JgdZBOGRPkB5xJ54D7FCHBvnvqjvVJKSkKpVZWE-b8h_gYnH29Y24Ym8cVhX68smDzJPOH8RlfK8wlAUQYeN6yzRidlAckmkMkM9n--trJwg79YOHdCXVB2xk-XbtB4Jzn5NXB2VWoNNLNZG5BxnUgakoNqs5kLsVOzUx3wGDwshRWEHCRMX-2CceolUnr3-rZGKVTuN00D79CB2IcbHDvUqmbKz9ac4nlqMFHICQNmW0Dvo9vOVT0U-e37Y1cwDkS-t2A0WScV20LbXfBOdkpAAddUJsRbqYJ0C1HF9glgdm50gUONLI6KRcxkebz1-EA1Y823f1tT_sGX7_zrTYKkHJPfLkKUIQ93u6ETXrQSv-2veSd6LIOKaFp3L3d-fSzf1mEQOGS3xjWgzwsHNUCAVTDUx507N_jd.ts",
    "sponsorship_disclosure_enabled": [0, false],
    "spotlight_creator_home_upsell_exp": [1, false],
    "spotlight_screenshare_warnings": ["code.exe", "chrome.exe", "discord.exe", "slack.exe", "taskmgr.exe", "calculator.exe", "twitchui.exe", "twitchstudioui.exe", "destiny2.exe", "electron.exe"],
    "squad_stream_ads_heartbeat_interval": 240000,
    "squad_stream_ads_heartbeat_max_jitter": 10000,
    "squad_stream_ads_send_primary_player": true,
    "squad_stream_survey_url": "",
    "stream_manager_views_tile_query_update": [0, false],
    "stream_summary_use_druid": false,
    "streamer_trailers_start_date": "2017-10-12T23:00:25.75536206Z",
    "strike_ccar_feature_enabled": [0, false],
    "studio-front-end-copy-paste": [0, false],
    "studio_af_alerts_migration": [1, true],
    "studio_companion_mode": [0, true],
    "studio_import": [0, false],
    "studio_import_changelog_date": "2022-05-23 00:00:00 GMT-0700",
    "studio_layer_rotation_flag": [0, false],
    "studio_multi_methods": [0, false],
    "studio_native_media_layer": [0, false],
    "studio_native_text_layer": [0, false],
    "studio_onboarding_tutorial_flag": [0, false],
    "studio_scene_templates_changelog_date": "2021-08-11 00:00:00 GMT-0700",
    "sua_rollout_date": "2021-11-30T20:45:00.963Z",
    "sua_rollout_enabled": true,
    "sub_modal_tier_upsell_enabled": true,
    "Subs_Geo_Breakdown": [1, false],
    "Subs_Geo_Breakdown_Beta_List": ["38206419", "151100773", "38770961", "50154496", "140519001", "27807625", "194967007", "20850617", "514657184", "137436058", "43547091", "58999722", "136837686", "19107317", "49335974", "23969535", "27928047", "80238475", "29721695", "40796986", "546490318", "32152294", "108256369", "181472330", "40446033", "416355690", "43960948", "72448313", "43943114", "52147160", "89081090", "32776386", "32346877", "63862222", "149857630", "64692329", "57429587", "35047674"],
    "subs_gift_progress": [1, true],
    "subscriber_badge_progression": true,
    "subtember_2021_end_date": "2021-09-30 23:59:00 GMT-0700",
    "subtember_2021_start_date": "2021-09-02 13:00:00 GMT-0700",
    "subtember_sponsored_cheermote_end_date": "2019-09-25T00:00:00Z",
    "subtember_updated_callout": true,
    "sunlight_roles_manager_editor_readonly": [0, false],
    "sw_rollout": [0, false],
    "tailor_shelves_feature_flag": [0, false],
    "talk_gs_alpha": [0, false],
    "tax_onboarding_maintenance": [0, false],
    "tcstring_rollout": [1, true],
    "tifa_enabled": [1, false],
    "tokenization": true,
    "track_sentry_failures": [0, false],
    "twilight_device_type": [0, true],
    "twitch_gift_card_url_us": "https://www.amazon.com/dp/B0893JQ2X2",
    "twitch_prime_fortnite": false,
    "twitch_prime_fortnite_link_url": "https://www.epicgames.com/fortnite/twitch-prime-pack2",
    "twitch_prime_fortnite_offer_id": "c0b1816d-300b-d234-828e-59e76119bffe",
    "twitch_prime_fortnite_signup_url": "https://twitch.amazon.com/prime/country?ref_=SM_CM_FNStart_LP&ingress=epic-fortnite",
    "twitch_prime_offerpage_signup_url": "https://twitch.amazon.com/prime/country",
    "twitch_studio_auto_exclude_from_VOD_and_clips_audio_source_list": ["TwitchSoundtrackUI.exe"],
    "untouch_cam_mig": "{}",
    "update_chunks": ["clips-main.css", "clips-main.js", "core.css", "core.js", "minimal.css", "minimal.js", "pages.browse.css", "pages.browse.js", "pages.channel.components.channel-shell.css", "pages.channel.components.channel-shell.js", "pages.channel.components.channel-shell.components.chat-shell.components.chat-live.css", "pages.channel.components.channel-shell.components.chat-shell.components.chat-live.js", "pages.channel.components.channel-shell.components.watch-page-track.css", "pages.channel.components.channel-shell.components.watch-page-track.js", "pages.directory-game.css", "pages.directory-game.js", "pages.front.css", "pages.front.js", "pages.following.css", "pages.following.js", "pages.settings.css", "pages.settings.js", "pages.subs.css", "pages.subs.js", "pages.subs.components.subs-broadcaster-page.css", "pages.subs.components.subs-broadcaster-page.js", "pages.subs-checkout.components.subs-checkout-page.css", "pages.subs-checkout.components.subs-checkout-page.js", "player-core-base.js", "sites.sunlight.pages.stream-summary-page.css", "sites.sunlight.pages.stream-summary-page.js", "vendor.js"],
    "use_intersection": true,
    "user_anniversary": [0, false],
    "V6S_iframe_to_div": [1, false],
    "verify_email_login": [1, false],
    "versus_splash_page_link": "/",
    "view_tax_forms_flag": [1, false],
    "viewer_milestones_enabled": true,
    "VLM_HLS_Midrolls": [1, false],
    "vod-clips-category-exclusion-feature-enabled": true,
    "vod_archives_vira_grand": "on",
    "vod_enable_highlight_reruns": true,
    "vod_premieres_sunset": "on",
    "vod_suggested_segments": "off",
    "vod_uploads_restriction": "restricted",
    "vodcast_deprecation_announcement_enabled": true,
    "vxp_blockbuster_creator_enabled": [1, true],
    "vxp_glitchcon": false,
    "vxp_multipass": [1, true],
    "vxp_seo_tag": true,
    "vxp_single_schedule_segments": [1, true],
    "watch_avatar_roundification": [1, false],
    "watch_avatar_roundification_notification": [0, false],
    "watch_channel_update_after_pubsub_max_rps": 2000,
    "watch_history_logging_enabled": [0, false],
    "watch_playback_by_id": [1, true],
    "watch_stunt_double_channels": ["dustyis"],
    "watch_update_fragment_viewcount": [1, true],
    "watch_use_stream_status_for_liveness": [0, false],
    "web_offers_rollout": [1, true],
    "web_sub_tokens": false,
    "why_sub_button": false,
    "wysiwyg_chat_input": [1, true],
    "xo_review_stage": "off",
    "xsolla_enabled": [1, true],
    "zuora_enabled": [1, false],
    "experiments": {
        "011d1499-61b3-49b2-92b2-b2ffd353ef00": {
            "name": "twilight_sub_gifting",
            "v": 2462,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "01512849-9609-4e72-861e-bdfacb313803": {
            "name": "support_panel_gifting",
            "v": 16927,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "Control"
            }, {
                "weight": 0,
                "value": "SupportMessaging"
            }, {
                "weight": 0,
                "value": "TabbedView"
            }]
        },
        "0186f46f-a8d8-40b9-963a-168302603fe8": {
            "name": "new_user_survey",
            "v": 5151,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "active"
            }]
        },
        "028ce2d5-c0e3-4517-8081-7e8f4556a55b": {
            "name": "channel_points_reward_limits_v2",
            "v": 11912,
            "t": 3,
            "s": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "029d2fb4-bf7e-44aa-a5af-a14ab5437c18": {
            "name": "AMV2_RELEASE",
            "v": 15173,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "ON"
            }, {
                "weight": 0,
                "value": "OFF"
            }, {
                "weight": 0,
                "value": "84238312,102931539,20544328"
            }]
        },
        "02b02e45-c2db-46f4-8140-a7a86bc040c8": {
            "name": "Community_Gifting_Bundle_Presentment",
            "v": 7829,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "030be5b3-dfa1-4271-b62f-e1a1dc4f5bda": {
            "name": "giftcard_redemption_in_checkout",
            "v": 17148,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "experiment"
            }]
        },
        "037c5d17-258e-4882-8760-a197a605faf5": {
            "name": "motivation_exp_lvf",
            "v": 20031,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "yes"
            }, {
                "weight": 100,
                "value": "no"
            }]
        },
        "03b5b151-a3ee-47f1-acab-6e496d9ace7d": {
            "name": "twilight_prime_gift_bomb_dashboard",
            "v": 8399,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "treatment"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "04283b1e-d699-43bd-8aef-d46ca7f8f97f": {
            "name": "chat_pause_hover_default",
            "v": 16614,
            "t": 2,
            "s": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "057d04f2-bfdd-465f-a854-612ebefc9bbd": {
            "name": "checkout_latency_experiment",
            "v": 16622,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "experiment"
            }]
        },
        "05dc2471-5696-4e15-9ff6-57d2fd4837c2": {
            "name": "pushy_onsite_email_verification",
            "v": 5240,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "064cdbc9-a25a-4000-a759-cb5d16762af7": {
            "name": "paypal_first_v2",
            "v": 8470,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "06b34663-884c-41ad-8e8f-8fd431e03995": {
            "name": "ABRNetworkLinkFilter",
            "v": 11585,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "06e28d69-ff23-470a-a69f-6e83395c46f8": {
            "name": "one_click_load_shed_AU",
            "v": 11554,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "07cba5d2-55ac-46ea-af6f-34fd3d759145": {
            "name": "twilight_settings_labelling",
            "v": 9626,
            "t": 1,
            "s": 1,
            "groups": [{
                "weight": 0,
                "value": "off"
            }, {
                "weight": 0,
                "value": "on"
            }, {
                "weight": 100,
                "value": "rest"
            }]
        },
        "08703cd4-7b66-4987-ad43-cddc7095cbc3": {
            "name": "player_core_ad_loudness",
            "v": 10930,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "09fe28c4-fb9a-4242-ad47-4cfb7f3da6af": {
            "name": "vx_disco_follow_nudge_logged_in",
            "v": 15924,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "one_minute"
            }, {
                "weight": 0,
                "value": "five_minutes"
            }, {
                "weight": 0,
                "value": "ten_minutes"
            }]
        },
        "0b4e4643-e741-4075-907b-67bb618e1d6e": {
            "name": "prime_gaming_crown_filter_menu",
            "v": 20744,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "0bddb46c-0c61-49a2-90f9-c6a91f2f35f2": {
            "name": "cg_tools_features_creator_goals",
            "v": 20939,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "0c53018f-422d-42c6-9ac4-4876fe203115": {
            "name": "mastercard_promotion",
            "v": 20704,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "0d2af185-1195-4816-a13a-8b2fa9fc8cd9": {
            "name": "social_proof_left_nav",
            "v": 16023,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "fmp_above"
            }, {
                "weight": 0,
                "value": "fmp_below"
            }, {
                "weight": 0,
                "value": "activity_above"
            }, {
                "weight": 0,
                "value": "activity_below"
            }, {
                "weight": 0,
                "value": "fmp_similarity_title"
            }, {
                "weight": 0,
                "value": "activity_similarity_title"
            }]
        },
        "0d552a1e-eb26-4e2a-bc80-9e1da4005a5c": {
            "name": "vx_disco_follow_focus",
            "v": 17394,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }, {
                "weight": 0,
                "value": "variant3"
            }]
        },
        "0d8b341f-c886-4adc-9454-d0f5265abec2": {
            "name": "player_skip_segment_on_error",
            "v": 11073,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "0dc9a9c9-fee5-4b5f-a462-f07675713e5e": {
            "name": "TWILIGHT_FOLLOWING_INDEX_LATEST_VIDEOS_V2",
            "v": 5983,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "enabled"
            }]
        },
        "0e636d13-56a8-44f4-bd51-7e65cd5a5225": {
            "name": "twilight_clips_howdy_partner",
            "v": 7767,
            "t": 1,
            "groups": [{
                "weight": 1,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "0f38e1d8-4437-473d-b75e-86d83a8f49fa": {
            "name": "twitchguard-launch-experiment",
            "v": 8988,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "Experiment"
            }, {
                "weight": 0,
                "value": "Control"
            }]
        },
        "0fd0ab7f-b90b-4573-81ab-d0b28fd62242": {
            "name": "cc_xo_avs",
            "v": 5761,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "off"
            }]
        },
        "0ff71e80-e0c2-4c33-9ef3-aae106eb6cd3": {
            "name": "aj_test2",
            "v": 20230,
            "t": 1,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "variant"
            }, {
                "weight": 100,
                "value": "bam"
            }]
        },
        "0ffc0f03-62b9-4220-8516-2b341efde6b3": {
            "name": "prime_bob",
            "v": 6769,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "treatment"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "10c75b60-f4c7-460b-99c8-e5caa22fd61f": {
            "name": "twilight_web_side_nav_upsell_center",
            "v": 4183,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "yes"
            }]
        },
        "11611bbf-0188-4d2f-a200-84358cfaaf57": {
            "name": "twilight_editing_les_poissons",
            "v": 4282,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "experiment"
            }]
        },
        "11b22bb1-eb3e-4a27-b9fd-13ccbfb5d691": {
            "name": "gift_x_more",
            "v": 8863,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant_1"
            }, {
                "weight": 0,
                "value": "variant_2"
            }, {
                "weight": 0,
                "value": "variant_3"
            }]
        },
        "11c3b7a8-f0cf-49ea-8776-ebe87d84b782": {
            "name": "twilight_quarterly_streamer_survey_for_new_streamers",
            "v": 8150,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "Control"
            }, {
                "weight": 0,
                "value": "Variant"
            }]
        },
        "11f76b25-03b0-4f44-b54f-ed8afe402dfe": {
            "name": "idplat_randor",
            "v": 16706,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "variant_1"
            }, {
                "weight": 100,
                "value": "variant_2"
            }, {
                "weight": 0,
                "value": "variant_3"
            }]
        },
        "1209a46f-b0a0-4b87-96ef-fbaead084515": {
            "name": "player_switch_manual_quality_on_error",
            "v": 11072,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "1209dd85-fa46-490f-87e3-f2626ef86f8d": {
            "name": "channel_benefits_page",
            "v": 10492,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "off"
            }, {
                "weight": 0,
                "value": "on"
            }]
        },
        "12806c8b-99ae-425b-88cc-3a6e4088a1c3": {
            "name": "cecg_category_suggestions",
            "v": 20645,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "12a2340d-84c9-42d7-a108-dd24a0c2d2df": {
            "name": "twilight_ad_request_builder_rollout",
            "v": 17145,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "12d93bfb-f920-495a-9a61-1f7259365f30": {
            "name": "vxp_remind_me_button",
            "v": 12951,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "1318509a-bf97-475d-acdc-df6a24ef6e3e": {
            "name": "twilight_videos_in_sidenav",
            "v": 2842,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "none"
            }, {
                "weight": 100,
                "value": "all_content"
            }, {
                "weight": 0,
                "value": "no_archives"
            }]
        },
        "13d9c799-61b8-45ad-bed9-7a9822483576": {
            "name": "memberships_heartbreak_allowed",
            "v": 18346,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "active"
            }]
        },
        "141862a5-32f9-47ec-b9d6-49c87830961b": {
            "name": "paypal_first",
            "v": 8224,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "145ddca3-2724-45ed-9ded-3bf9d2e79811": {
            "name": "vx_left_nav_category_click_thru",
            "v": 14189,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "164332c9-759a-46f5-92de-63d43ff2fd35": {
            "name": "twilight_web_side_nav_upsell_center_channels",
            "v": 7313,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 0,
                "value": "learn"
            }, {
                "weight": 0,
                "value": "support"
            }, {
                "weight": 0,
                "value": "liveup"
            }, {
                "weight": 0,
                "value": "rec"
            }, {
                "weight": 100,
                "value": "bullet"
            }]
        },
        "164f1efb-78b9-4a86-a9c1-18829f61ab90": {
            "name": "watch_verify_email",
            "v": 6243,
            "t": 1,
            "groups": [{
                "weight": 1,
                "value": "control"
            }, {
                "weight": 99,
                "value": "treatment"
            }]
        },
        "16a720bc-7a74-4de0-963c-4610942d45fd": {
            "name": "player_error_recovery_combined",
            "v": 12952,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "disable_manual_recovery"
            }, {
                "weight": 0,
                "value": "skip_recovery"
            }, {
                "weight": 0,
                "value": "recover_transcode"
            }, {
                "weight": 0,
                "value": "release_removed"
            }]
        },
        "16fc8592-4e1e-4750-9a4e-e7ddd7e4ca3e": {
            "name": "cutwater_embeds_upsell_standard",
            "v": 13448,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "soft_variant"
            }]
        },
        "172f025c-5e5d-49e3-9e7f-29e2d2505f8e": {
            "name": "extensions_pick_up_where_you_left_off",
            "v": 9359,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "test"
            }]
        },
        "17620d7e-3772-4fea-9edf-6f4860369379": {
            "name": "creatorhome_ffa_stream_progress",
            "v": 18794,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "198744b6-e96f-413b-aaf6-eab0128c9833": {
            "name": "signup_redirect_search",
            "v": 2153,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "games"
            }, {
                "weight": 0,
                "value": "popular"
            }, {
                "weight": 0,
                "value": "search"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "1a445d6d-d9f8-4ce8-8467-19e3e3f2d84b": {
            "name": "simplified_gifting_offer_presentment",
            "v": 20756,
            "t": 2,
            "s": 3,
            "groups": [{
                "weight": 0,
                "value": "variant"
            }, {
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant_slim"
            }, {
                "weight": 0,
                "value": "custom_top"
            }, {
                "weight": 0,
                "value": "custom_bottom"
            }, {
                "weight": 0,
                "value": "custom_top_goals"
            }, {
                "weight": 0,
                "value": "custom_bottom_goals"
            }, {
                "weight": 0,
                "value": "custom_top_goals_anon_tiers"
            }, {
                "weight": 0,
                "value": "custom_bottom_goals_anon_tiers"
            }]
        },
        "1ac99b84-5ee9-473c-98f7-fc265739cbc5": {
            "name": "cecg_vod_tool_prod_r2",
            "v": 20784,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "variant"
            }]
        },
        "1b7642d7-179a-46b4-b249-cff86b981343": {
            "name": "studio_onboarding_tutorial",
            "v": 18861,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "1c668d47-f15d-43ce-a54c-b2e27eeaa6b6": {
            "name": "experiments_json_ts",
            "v": 6758,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "variant0"
            }, {
                "weight": 50,
                "value": "variant1"
            }]
        },
        "1cd79823-d99e-4874-85a6-bf5d8dffccc3": {
            "name": "bl3_suggested",
            "v": 8179,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "sugg_tags"
            }]
        },
        "1f7e7664-f082-44cc-847e-e57dec0a6bb9": {
            "name": "vx_defer",
            "v": 13011,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "2005226d-07fe-46cf-a229-d91dd03d8d3a": {
            "name": "delete_XP",
            "v": 3634,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "off"
            }, {
                "weight": 0,
                "value": "on"
            }]
        },
        "20432910-585e-428d-be53-f5de0d93e2de": {
            "name": "french_vanilla",
            "v": 5254,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant_a"
            }]
        },
        "20bf4ac5-f61d-44a7-8f6d-1106101d4a80": {
            "name": "take_the_leaderboard",
            "v": 19345,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "Control"
            }, {
                "weight": 100,
                "value": "TakeTop10Spot"
            }]
        },
        "210067b4-7808-40da-aaca-886f1c1bd524": {
            "name": "TWILIGHT_AAX_DISPLAY_NA",
            "v": 16234,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "GAM"
            }, {
                "weight": 100,
                "value": "AAX"
            }]
        },
        "214f827d-459a-473b-aa06-4362c9e45257": {
            "name": "prowse_li_intelshelf",
            "v": 8892,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "218acff9-67f7-459f-9f3e-d9b41238e761": {
            "name": "ht_celeb_experiment",
            "v": 17652,
            "t": 3,
            "s": 2,
            "groups": [{
                "weight": 0,
                "value": "Control"
            }, {
                "weight": 100,
                "value": "VariantA"
            }, {
                "weight": 0,
                "value": "VariantB"
            }, {
                "weight": 0,
                "value": "VariantC"
            }]
        },
        "2437b38a-0fbf-4fe8-83ee-75b4b7f17469": {
            "name": "flix_sub_shelf",
            "v": 12643,
            "t": 2,
            "groups": [{
                "weight": 85,
                "value": "control"
            }, {
                "weight": 5,
                "value": "dnr"
            }, {
                "weight": 5,
                "value": "variant_2"
            }, {
                "weight": 5,
                "value": "variant_3"
            }]
        },
        "24438da2-e87e-4755-83f1-ccf1f5c70c1c": {
            "name": "consent_banner_headline",
            "v": 19265,
            "t": 2,
            "groups": [{
                "weight": 10,
                "value": "A"
            }, {
                "weight": 10,
                "value": "B"
            }, {
                "weight": 10,
                "value": "C"
            }, {
                "weight": 10,
                "value": "D"
            }, {
                "weight": 10,
                "value": "E"
            }, {
                "weight": 10,
                "value": "F"
            }, {
                "weight": 40,
                "value": "control"
            }]
        },
        "247060fe-e910-402c-8cfa-4fce2fba95c6": {
            "name": "sub_modal_pretest",
            "v": 6585,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }, {
                "weight": 0,
                "value": "variant_b"
            }]
        },
        "24a9fd71-71a6-4d1a-890a-9c61a6475f7e": {
            "name": "flix_promoter_rollout",
            "v": 10004,
            "t": 1,
            "s": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant0"
            }]
        },
        "2559f1ee-d998-4fb5-8be7-9213e688a589": {
            "name": "bits_skus_reduction",
            "v": 9458,
            "t": 2,
            "groups": [{
                "weight": 9500,
                "value": "control"
            }, {
                "weight": 125,
                "value": "A"
            }, {
                "weight": 125,
                "value": "B"
            }, {
                "weight": 125,
                "value": "C"
            }, {
                "weight": 125,
                "value": "D"
            }]
        },
        "26869b8b-7885-4b2e-a677-5ea918c5ab2a": {
            "name": "sub_reanimator",
            "v": 4807,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant_a"
            }, {
                "weight": 0,
                "value": "variant_b"
            }]
        },
        "27036b5f-8b74-4da1-9bad-a6eaa25a4c33": {
            "name": "navi_li_similarity",
            "v": 17628,
            "t": 2,
            "s": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "2789d6cc-a2e9-486d-a022-e792d73ea46b": {
            "name": "vxp_contextual_upsell",
            "v": 15341,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "signup"
            }, {
                "weight": 0,
                "value": "copy"
            }, {
                "weight": 0,
                "value": "signup_and_copy"
            }]
        },
        "27a78957-f1c7-465c-96cd-068e6b144f80": {
            "name": "expressions_emote_picker_qol",
            "v": 14544,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "off"
            }]
        },
        "27c0c26b-9d51-4b84-900c-e1419cc9f68f": {
            "name": "ads_multiplayer_experiment",
            "v": 16531,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "no_ui"
            }, {
                "weight": 0,
                "value": "modal_confirmation_basic_info"
            }, {
                "weight": 0,
                "value": "modal_confirmation_payout_info"
            }, {
                "weight": 0,
                "value": "modal_confirmation_full_info"
            }]
        },
        "298a5f39-228a-487a-ad06-422c18458403": {
            "name": "twilight_merch_store_launch",
            "v": 2159,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "true"
            }]
        },
        "29a37cfd-6a34-4624-970f-6b155b40636b": {
            "name": "twilight_web_onboarding_randomized_games",
            "v": 3101,
            "t": 2,
            "groups": [{
                "weight": 1,
                "value": "control"
            }, {
                "weight": 0,
                "value": "enabled"
            }]
        },
        "2a419c5c-16b5-48fa-83d4-a5764408545b": {
            "name": "TWILIGHT_AAX_DISPLAY_DIRECTORY_M1",
            "v": 16232,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "GAM"
            }, {
                "weight": 100,
                "value": "AAX"
            }]
        },
        "2a6f86ad-28b6-4954-a73e-5d247d4cc42a": {
            "name": "more_default_quick_actions",
            "v": 18416,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant 1"
            }]
        },
        "2a90d5d9-47ba-47d5-9f92-4b12a7d62ae2": {
            "name": "leftnav_recommended_promoted_streams",
            "v": 17170,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "2c169854-dedd-41d0-8e55-a20ce75424ec": {
            "name": "leftnav_li_similarity_isolated",
            "v": 12162,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }]
        },
        "2c54d222-9f10-47b1-932c-2f296ba75d1b": {
            "name": "vx_disco_signup_nudge",
            "v": 16839,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "2cc56231-050e-4e3b-96d2-ff85d602aab7": {
            "name": "gifting_bundle_animations_experiment",
            "v": 12674,
            "t": 2,
            "s": 1,
            "groups": [{
                "weight": 180,
                "value": "control"
            }, {
                "weight": 10,
                "value": "variantA"
            }, {
                "weight": 10,
                "value": "variantB"
            }]
        },
        "2cd9aeac-321a-4cea-abfe-20534a7ab6ed": {
            "name": "gift_chat_command_callout",
            "v": 18115,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "active"
            }]
        },
        "2d4a0ad4-1658-4cfb-a542-896b3a8524cc": {
            "name": "contextual_auth_modals_v2",
            "v": 5726,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 0,
                "value": "balloon"
            }, {
                "weight": 100,
                "value": "split"
            }, {
                "weight": 0,
                "value": "two_step"
            }]
        },
        "306b5fc1-d28c-4603-b2de-462d32c207bd": {
            "name": "ads_countdown_timers",
            "v": 5877,
            "t": 1,
            "groups": [{
                "weight": 5,
                "value": "A"
            }, {
                "weight": 5,
                "value": "B"
            }, {
                "weight": 90,
                "value": "control"
            }]
        },
        "30a3a1c0-55bf-4c56-93b8-55fd3ed20011": {
            "name": "ABR NetworkLinkInfo",
            "v": 9264,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "30a4fa5c-ae9a-4218-a374-258ea981190a": {
            "name": "last_x_events",
            "v": 20620,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "events"
            }, {
                "weight": 0,
                "value": "milestones"
            }]
        },
        "3128fa9f-5059-4186-a47d-e35ed3a2c649": {
            "name": "ttv_primary_content_2",
            "v": 5896,
            "t": 1,
            "groups": [{
                "weight": 60,
                "value": "control"
            }, {
                "weight": 20,
                "value": "ready"
            }, {
                "weight": 20,
                "value": "video"
            }]
        },
        "3275d487-852c-4679-871a-e0425629e4f4": {
            "name": "sunlight_broadcast_page_experiment",
            "v": 20733,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "32841811-2c64-41dd-b7b0-bd5fd5cd3a12": {
            "name": "vx_disco_personalized_cards",
            "v": 17373,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "332938cf-904f-401e-ae6c-c1295ef0e8ba": {
            "name": "time_since_last_ad_cooldown",
            "v": 16814,
            "t": 3,
            "s": 1,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "339010ee-1d18-4e91-8fd7-25b0848d279b": {
            "name": "vx_disco_search_suggestions_v1_logged_out",
            "v": 17275,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }, {
                "weight": 0,
                "value": "variant3"
            }]
        },
        "339f74af-0cbc-4e50-a4c9-cc47ffea05e4": {
            "name": "bits_card_simplified_cheermote_selection",
            "v": 16750,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "variant"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "3421e6e0-aa9e-4738-8b60-73cb6eac8dea": {
            "name": "sidenav_active_gift",
            "v": 19052,
            "t": 2,
            "s": 1,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "variant"
            }]
        },
        "344180c2-5108-452a-841c-5a244d8e6d01": {
            "name": "promotions_holdout_user_id",
            "v": 10476,
            "t": 2,
            "groups": [{
                "weight": 96,
                "value": "control"
            }, {
                "weight": 4,
                "value": "holdout"
            }]
        },
        "365bff31-5b22-454a-8438-0f8d56f561fa": {
            "name": "subtier_button_price_cta",
            "v": 16244,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant_price_in_btn"
            }]
        },
        "36a39ecd-42d2-4c4f-ad43-1d40b48378c2": {
            "name": "multimonth_evergreen_discount",
            "v": 16591,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "372a1386-6285-439b-8439-bdb320d83e78": {
            "name": "vx_left_pop",
            "v": 13771,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "38b59330-9056-47a5-a858-615dcd103666": {
            "name": "disco_sprig_logged_out",
            "v": 19076,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "3ac496e5-3cd2-4e98-a75b-1f3125dc9688": {
            "name": "free_trial_cta_v2",
            "v": 21100,
            "t": 2,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "variant1"
            }]
        },
        "3c96ce24-799b-4758-9b0e-adef8f490a33": {
            "name": "xsolla_back_button",
            "v": 17944,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "3d32141f-1133-42a0-a100-7f0927530062": {
            "name": "disco_recs_context",
            "v": 18654,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "3e7dadb5-d84a-4bb9-a96a-438e9077f65e": {
            "name": "community-gifting-reduce-friction",
            "v": 9511,
            "t": 1,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "treatment"
            }]
        },
        "3ef03482-99c0-4415-ad0a-58d8cd0e8ebb": {
            "name": "one_click_load_shed_KR",
            "v": 11553,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "3fa741f6-0bc9-425a-a618-e0ce1e45463a": {
            "name": "to_the_edge",
            "v": 15981,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "3fc50829-31d6-449a-a757-7a3f44d77ab3": {
            "name": "twilight_new_reporting_wizard",
            "v": 6340,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "40cccbb0-2936-4116-9b58-417fdee39806": {
            "name": "better_onsite_gift_notifications",
            "v": 19760,
            "t": 2,
            "groups": [{
                "weight": 90,
                "value": "control"
            }, {
                "weight": 10,
                "value": "active"
            }]
        },
        "416c1ee6-9adc-43e1-8e98-cd761068bc0b": {
            "name": "twilight_player_version",
            "v": 2325,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "mainline"
            }, {
                "weight": 50,
                "value": "fork"
            }]
        },
        "41cc8630-60da-4689-a8aa-7bf6f414faca": {
            "name": "ride_the_wave",
            "v": 4690,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "wave"
            }]
        },
        "42285932-9144-4be5-9532-afc42580ebf2": {
            "name": "grandpere",
            "v": 8459,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "enhanced"
            }, {
                "weight": 0,
                "value": "final"
            }]
        },
        "4240d6df-f34f-4732-a9ae-2f77b5225462": {
            "name": "twilight_presence_smoothing",
            "v": 12867,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 0,
                "value": "debounce"
            }, {
                "weight": 100,
                "value": "debounce_and_raid_heartbeat"
            }, {
                "weight": 0,
                "value": "debounce_and_all_heartbeat"
            }]
        },
        "429018e2-0cab-4ec4-a129-8a93c4f2b1b9": {
            "name": "norton_badge_v2",
            "v": 11684,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant_a"
            }, {
                "weight": 0,
                "value": "variant_b"
            }]
        },
        "42a1e26c-b3db-420f-a21f-5eba13902252": {
            "name": "twilight_bits_bundle_presentation_update_on_user_id",
            "v": 6827,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "percent_more"
            }, {
                "weight": 0,
                "value": "percent_savings"
            }, {
                "weight": 0,
                "value": "bonus_amount"
            }]
        },
        "4318b5f4-1b38-4f24-ac5c-0d6127d1c252": {
            "name": "cg_3_bundle",
            "v": 9292,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "A"
            }, {
                "weight": 0,
                "value": "B"
            }, {
                "weight": 0,
                "value": "C"
            }, {
                "weight": 0,
                "value": "D"
            }]
        },
        "44a503af-d77f-4f1d-9fa4-c99c5f783f9c": {
            "name": "twilight_video_manager_release",
            "v": 2850,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "no"
            }, {
                "weight": 100,
                "value": "yes"
            }]
        },
        "4524eda3-ae03-4a4d-a821-a65a83ef7687": {
            "name": "TWILIGHT_AAX_DISPLAY_CATCH_ALL",
            "v": 16236,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "GAM"
            }, {
                "weight": 100,
                "value": "AAX"
            }]
        },
        "4664cf2d-0df6-43fb-8196-25fac34700d5": {
            "name": "wysiwyg_chat_input_user_id",
            "v": 20301,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "466eb891-eccf-4cd3-9946-021e3f8f7d78": {
            "name": "sda_post_fill_drop_eligibility",
            "v": 17503,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "47597570-dd4e-4996-85eb-86db164cae9c": {
            "name": "TWILIGHT_AML_RANKING_FOLLOWS",
            "v": 5165,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "49083595-80d4-4c13-93a2-20a605b3318e": {
            "name": "Player Core WASM experiment",
            "v": 6558,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "wasm"
            }, {
                "weight": 0,
                "value": "asmjs"
            }]
        },
        "49f40b88-2044-409d-b306-2eb308489a60": {
            "name": "Twilight_Upsell",
            "v": 4195,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "upsell"
            }]
        },
        "4a0430e5-e05c-4790-ba33-0944209afc41": {
            "name": "one_click_load_shed_EU27",
            "v": 11555,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "4a21eec0-1de5-469e-b755-0d1087bbf18b": {
            "name": "one_click",
            "v": 21131,
            "t": 1,
            "groups": [{
                "weight": 85,
                "value": "control"
            }, {
                "weight": 5,
                "value": "experiment"
            }, {
                "weight": 5,
                "value": "variant_1"
            }, {
                "weight": 5,
                "value": "variant_2"
            }]
        },
        "4a2f2094-32ab-4ddb-bc1f-3ca7917b6a5c": {
            "name": "one_click_load_shed_BR",
            "v": 11552,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "4a567053-3ece-44bc-9496-9519a37a6053": {
            "name": "theatre-mode-social-panel-v2",
            "v": 8394,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant_a"
            }]
        },
        "4abc50dc-41d1-413e-8d5b-64acd88f6938": {
            "name": "ad_moat_amazon",
            "v": 7543,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "enabled"
            }]
        },
        "4abe3840-c041-4410-b3c2-d4d51c69ca6d": {
            "name": "simplify_single_gift",
            "v": 12798,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "4aff903b-0b25-496e-a8a5-ade2fc9bfadb": {
            "name": "graph_generic_collection_test",
            "v": 18389,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }, {
                "weight": 0,
                "value": "variant3"
            }]
        },
        "4b542915-a76e-42ad-ab85-147642feb395": {
            "name": "post_purchase_experience",
            "v": 18241,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "4b59d3a3-2a23-41a0-b0f6-a588969cf052": {
            "name": "cutwater_embeds_recs",
            "v": 18737,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "4bc764f2-f282-41e9-8aeb-15cb1f132d78": {
            "name": "animated_emotes_for_affiliates",
            "v": 18817,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "active"
            }]
        },
        "4d3d19a7-38c5-4328-9730-7d99565d5edd": {
            "name": "twilight_premiere_upload_flow",
            "v": 2851,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "no"
            }, {
                "weight": 100,
                "value": "yes"
            }]
        },
        "4ed6d4e5-caa6-4c5f-8880-d376328ffb4a": {
            "name": "one_click_checkout_v0_1",
            "v": 11551,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "4ef36ab5-119c-4250-91c2-83ffb789c9dd": {
            "name": "twilight_prime_override_offer",
            "v": 5425,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "off"
            }, {
                "weight": 100,
                "value": "on"
            }]
        },
        "4f82dd22-cf09-44a5-8f17-9641e0cbb3bd": {
            "name": "use_rare_candy_quests",
            "v": 13849,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "508f84b8-caaa-48b6-95ef-a0fd73caf914": {
            "name": "disco_channel_switcher_logged_out",
            "v": 19831,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "528b7aba-ae3b-46ab-a5a9-b60689079d4f": {
            "name": "cc_xo_lims",
            "v": 5412,
            "t": 1,
            "groups": [{
                "weight": 80,
                "value": "on"
            }, {
                "weight": 20,
                "value": "off"
            }]
        },
        "52fddb9d-f51c-415c-8329-96eb7f464cbd": {
            "name": "celebi_experiment",
            "v": 9599,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "experiment"
            }]
        },
        "53829145-1f99-483c-adf0-2ac3043a03c3": {
            "name": "extensions_installation_optimization",
            "v": 11389,
            "t": 3,
            "groups": [{
                "weight": 34,
                "value": "control"
            }, {
                "weight": 33,
                "value": "test"
            }, {
                "weight": 33,
                "value": "test_no_later_button"
            }]
        },
        "545d72f6-7809-4281-a329-cb3750cb0301": {
            "name": "vxp_bottom_banner",
            "v": 16350,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "banner"
            }, {
                "weight": 0,
                "value": "banner_with_count"
            }, {
                "weight": 0,
                "value": "banner_new_tab"
            }]
        },
        "54648285-230e-4448-aba0-74e2b6fce71c": {
            "name": "TWILIGHT_VOD_KIRK",
            "v": 5605,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "top"
            }, {
                "weight": 0,
                "value": "bottom"
            }]
        },
        "5684b8eb-5d61-4685-84e2-43090b32179d": {
            "name": "extensions_turn_off_for_viewers",
            "v": 5298,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "test"
            }]
        },
        "56c7bb02-7fe7-41e3-a719-e84d762e72d6": {
            "name": "copo_multi_option_predictions",
            "v": 20687,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "56ea4f1e-bcfc-4ed3-8b64-f471f8b872f0": {
            "name": "default_emotes_new_affiliates",
            "v": 16816,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "5846909c-a259-49c6-b235-ccb9507aaf4d": {
            "name": "twilight_quarterly_streamer_survey_for_partners",
            "v": 8148,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "Control"
            }, {
                "weight": 0,
                "value": "Variant"
            }]
        },
        "59923599-4c38-478d-b930-e7f03cfd2259": {
            "name": "CSI_LOOK_WHAT_YOU_MADE_ME_DO",
            "v": 5521,
            "t": 2,
            "groups": [{
                "weight": 90,
                "value": "true"
            }, {
                "weight": 10,
                "value": "false"
            }]
        },
        "59cbe6c8-2355-403e-aa3a-ab22310adebe": {
            "name": "aml_ranking_follows",
            "v": 4106,
            "t": 2,
            "s": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "two_then_one"
            }, {
                "weight": 0,
                "value": "every_other"
            }, {
                "weight": 0,
                "value": "just_two"
            }, {
                "weight": 0,
                "value": "just_one"
            }, {
                "weight": 0,
                "value": "complete"
            }]
        },
        "5a337f67-d3b2-4929-8421-98bdf542c069": {
            "name": "twilight_prime_gift_bomb_device",
            "v": 9537,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "treatment"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "5a8345e2-4ba8-4c13-a955-63e148fa7b59": {
            "name": "cutwater_embeds_upsell_gray",
            "v": 13447,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "soft_variant"
            }, {
                "weight": 0,
                "value": "hard_variant"
            }]
        },
        "5aa83e03-4b09-4387-9c30-2d03bd8f79ee": {
            "name": "twilight_subs_prime_2_paid",
            "v": 6401,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "variant_a"
            }, {
                "weight": 0,
                "value": "variant_b"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "5b184339-90a9-4706-bdd6-44a3f658ad82": {
            "name": "ca_emote_perform",
            "v": 17889,
            "t": 3,
            "s": 2,
            "groups": [{
                "weight": 100,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "5bbb7686-196f-40c3-b938-8b33cf6d4343": {
            "name": "creator_anniversaries_left_nav",
            "v": 18197,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "5c7b5e0f-15f6-4514-9838-9c105aead361": {
            "name": "player_release_removed_qualities",
            "v": 10636,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "5c8e4a59-8c63-4000-9c4e-6224f34b7c21": {
            "name": "twilight_web_onboarding_channel_surfing",
            "v": 4245,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "chat"
            }, {
                "weight": 0,
                "value": "no_chat"
            }]
        },
        "5c931adb-4a60-4a57-a181-294098fc274a": {
            "name": "cf_wp_new_onboarding",
            "v": 12915,
            "t": 3,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "variant"
            }]
        },
        "5cd27833-d069-4259-bf8b-b1f4c60ec9b1": {
            "name": "gem_gem_gem_gem",
            "v": 7268,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "target"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "5cfa2a90-54f0-4dcc-b28c-45f33935718e": {
            "name": "TWILIGHT_VOD_REDITUS",
            "v": 2940,
            "t": 1,
            "groups": [{
                "weight": 33,
                "value": "following_basic"
            }, {
                "weight": 33,
                "value": "following_advanced"
            }, {
                "weight": 33,
                "value": "control"
            }]
        },
        "5e5c3b4f-81f9-4e3a-8643-5388d18222d2": {
            "name": "reduce_subs_confusion",
            "v": 16123,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "experiment"
            }]
        },
        "5e81b581-d7cb-4066-987b-5a219ddd1702": {
            "name": "sub_mgmt_modal",
            "v": 6071,
            "t": 2,
            "groups": [{
                "weight": 70,
                "value": "control"
            }, {
                "weight": 30,
                "value": "variant"
            }]
        },
        "5e8985ec-6c1e-4b0b-be6a-1dd9ac6c5edf": {
            "name": "disco_simplify_logged_out_channel_page",
            "v": 18679,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "5fd568be-2073-4f99-84d5-565e8b2a3343": {
            "name": "TWILIGHT_AAX_DISPLAY",
            "v": 3615,
            "t": 1,
            "s": 4,
            "groups": [{
                "weight": 95,
                "value": "yes"
            }, {
                "weight": 5,
                "value": "no"
            }]
        },
        "6000221a-906c-4087-85b8-fd99c936c900": {
            "name": "vxchan_stream_1.1_actions",
            "v": 19403,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "61a88b03-5eaa-4693-9beb-99d0695432da": {
            "name": "es_kr",
            "v": 6046,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "ctrl"
            }, {
                "weight": 0,
                "value": "es"
            }, {
                "weight": 0,
                "value": "es_hd"
            }]
        },
        "61ea1641-8702-4062-a99b-15a1b7dff0c2": {
            "name": "TEST_PLAYER_CORE",
            "v": 8959,
            "t": 1,
            "groups": [{
                "weight": 90,
                "value": "control"
            }, {
                "weight": 10,
                "value": "fire"
            }]
        },
        "6245b358-3271-434f-bc17-eeb0c8982a2a": {
            "name": "latency_stats_monotonic",
            "v": 19943,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "63ce5036-1f44-4555-9aac-1daa84571ae8": {
            "name": "mads_poll_channel_points",
            "v": 16335,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "CHANNEL_POINTS_0x"
            }, {
                "weight": 0,
                "value": "CHANNEL_POINTS_1x"
            }]
        },
        "64efc0f7-dd26-49e3-bc61-2cb1bc759990": {
            "name": "experiments_json_tds",
            "v": 6755,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "variant0"
            }, {
                "weight": 50,
                "value": "variant1"
            }]
        },
        "64f5c2ae-7746-41cb-a817-983ae8bc0b4f": {
            "name": "fgwpClaimingOnPGHQ",
            "v": 11678,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "6699df7d-9f23-494c-87a1-06fdf80f1e68": {
            "name": "twilight_video_card_updates",
            "v": 3893,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variation"
            }]
        },
        "66c396a7-f23b-431b-9c69-a05af529565f": {
            "name": "jcb_icon_jp",
            "v": 16669,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "6723b8fc-7962-436e-ab7a-954199c97c2a": {
            "name": "twilight_roster_gql",
            "v": 16523,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "6a1cba54-d5d3-4117-ab42-06bd5514a134": {
            "name": "mobile_native_user_id_experiment",
            "v": 9191,
            "t": 2,
            "groups": [{
                "weight": 20,
                "value": "b1"
            }, {
                "weight": 20,
                "value": "b2"
            }, {
                "weight": 20,
                "value": "b3"
            }, {
                "weight": 20,
                "value": "b4"
            }, {
                "weight": 20,
                "value": "b5"
            }]
        },
        "6a244f0e-2e97-4039-b631-4e9e138fe9d3": {
            "name": "picture_by_picture_player_resize",
            "v": 17535,
            "t": 1,
            "groups": [{
                "weight": 97,
                "value": "control"
            }, {
                "weight": 1,
                "value": "treatment_small"
            }, {
                "weight": 1,
                "value": "treatment_medium"
            }, {
                "weight": 1,
                "value": "treatment_large"
            }]
        },
        "6a55a881-2e43-4e1b-9ff2-de8916d6f80e": {
            "name": "VP09 Web",
            "v": 17217,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "6a7ad315-a7ee-4feb-a0ab-887b12710f82": {
            "name": "disco_hol_up",
            "v": 7474,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "6a7c6d6c-09fa-444e-9192-badfaddde36b": {
            "name": "emote_card_sub_button",
            "v": 6084,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "sub_button"
            }]
        },
        "6aca9921-86b6-434c-a941-111e3a74a384": {
            "name": "pg_ou_crown_ordering",
            "v": 16165,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "off"
            }, {
                "weight": 0,
                "value": "on"
            }]
        },
        "6c03c997-6935-4d9b-99f8-9d83865bde26": {
            "name": "free_trial_cta",
            "v": 15832,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "6c924bf0-aa95-411a-b97f-a6fd2c184576": {
            "name": "vx_tag_id",
            "v": 14979,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "6dad76f4-4183-441b-a5ee-487c49eb2af5": {
            "name": "web_sub_tokens",
            "v": 17942,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "6e3136e5-f715-4a99-9e53-08fcdc521508": {
            "name": "prime_gaming_cta_text_experiment_odp",
            "v": 13509,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "get_loot"
            }, {
                "weight": 0,
                "value": "get_in_game_content"
            }, {
                "weight": 0,
                "value": "get_free_with_prime"
            }, {
                "weight": 0,
                "value": "claim_loot"
            }, {
                "weight": 0,
                "value": "claim_in_game_content"
            }, {
                "weight": 0,
                "value": "claim_free_with_prime"
            }]
        },
        "6fbde053-695a-44f4-a518-9de5c698b87e": {
            "name": "cheering2.0_bits_pinata",
            "v": 15659,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "Control"
            }, {
                "weight": 0,
                "value": "Experiment"
            }]
        },
        "70d644ce-1c05-45e2-a123-01ee010fee53": {
            "name": "poliwag_v1",
            "v": 7960,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "active"
            }]
        },
        "7172b14c-151c-4a39-8c26-2b3223d3eab0": {
            "name": "LL_RTB",
            "v": 13339,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "7208f451-2cde-4822-82b1-d7f43ba3807c": {
            "name": "vxp_lcp_videos",
            "v": 14545,
            "t": 3,
            "s": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "active"
            }]
        },
        "72c14aa9-d78d-4095-8f27-d97b9aac4233": {
            "name": "TWILIGHT_SUB_CHECKOUT_POPUP",
            "v": 3022,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "yes"
            }, {
                "weight": 100,
                "value": "no"
            }]
        },
        "74156eb2-ed95-482c-b006-60c1428e8846": {
            "name": "twilight_web_onboarding_channel_ranking",
            "v": 3463,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "yes"
            }]
        },
        "742b7531-8f5c-4c62-9099-7b2a60048ab2": {
            "name": "player_cs",
            "v": 6562,
            "t": 1,
            "s": 1,
            "groups": [{
                "weight": 1,
                "value": "fa"
            }]
        },
        "74cf95b0-e0bc-4485-938e-849cbb36ea7f": {
            "name": "pause_your_sub",
            "v": 15683,
            "t": 2,
            "groups": [{
                "weight": 1000,
                "value": "c"
            }, {
                "weight": 0,
                "value": "t1"
            }]
        },
        "75397567-90b5-413c-9500-e3d35d6b8669": {
            "name": "press_the_button",
            "v": 4575,
            "t": 1,
            "s": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "magic"
            }]
        },
        "7678a52b-b88b-491b-b2af-63863fbc0fb0": {
            "name": "dart_liveup",
            "v": 12405,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "77e51732-1a86-4be7-91d3-f67f1512d7b2": {
            "name": "hide_redundant_payment_methods",
            "v": 12537,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "experiment"
            }]
        },
        "781530f1-5a77-449c-9d1e-604db8050127": {
            "name": "stream_summary_email",
            "v": 6932,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "test"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "7911e151-3797-4041-b16e-4be5cd33bfad": {
            "name": "twilight_editing_under_the_sea",
            "v": 4475,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "experiment"
            }]
        },
        "79b1597d-2430-4251-8f89-0168924fc581": {
            "name": "midnight_squid_deprecated",
            "v": 19767,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "Control"
            }, {
                "weight": 0,
                "value": "Experiment"
            }]
        },
        "79da5ceb-170d-4548-85e2-3a9c85431404": {
            "name": "escape_hatch",
            "v": 7608,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "active"
            }]
        },
        "7aa589f3-34d8-425f-8227-29007d50757e": {
            "name": "twilight_growth_email_verify_bar",
            "v": 5239,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "enabled"
            }]
        },
        "7b8d95e0-69f8-403f-bf2a-e9efe6233b36": {
            "name": "ttv_primary_content",
            "v": 5942,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "ready"
            }, {
                "weight": 0,
                "value": "video"
            }]
        },
        "7b9eb0f0-c37e-447c-81bf-5a32b2df3c59": {
            "name": "sunlight_streaming_software",
            "v": 8629,
            "t": 3,
            "groups": [{
                "weight": 90,
                "value": "studio"
            }, {
                "weight": 5,
                "value": "obs"
            }, {
                "weight": 5,
                "value": "slobs"
            }]
        },
        "7be6e176-3c3e-46a3-ab50-abd8dc73da1e": {
            "name": "Twilight Player Core NPM Distribution (Staff)",
            "v": 21030,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "base"
            }, {
                "weight": 0,
                "value": "variant-a"
            }, {
                "weight": 0,
                "value": "variant-b"
            }, {
                "weight": 100,
                "value": "variant-m"
            }]
        },
        "7c6f06b3-ddbd-40ac-8f7e-c883dd2ff3f4": {
            "name": "LIHP_rec_leftnav",
            "v": 11009,
            "t": 2,
            "s": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "7ccfd606-6941-4806-9af6-7052e61acef0": {
            "name": "fring_delayed_preroll",
            "v": 13081,
            "t": 3,
            "groups": [{
                "weight": 25,
                "value": "off"
            }, {
                "weight": 25,
                "value": "10s"
            }, {
                "weight": 25,
                "value": "20s"
            }, {
                "weight": 25,
                "value": "30s"
            }]
        },
        "7cdee701-0ac3-4b47-94d3-b47b3b707dc8": {
            "name": "nielsen_analytics",
            "v": 7985,
            "t": 1,
            "groups": [{
                "weight": 1,
                "value": "active"
            }, {
                "weight": 0,
                "value": "inactive"
            }]
        },
        "7de935e6-c8c7-4be7-b694-199a7ec19aa7": {
            "name": "TWILIGHT_AAX_ROLLOUT",
            "v": 9725,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "7e26934a-3cb5-47af-9fd9-fd1aa4a41ef6": {
            "name": "gifting_user_notice_standardization",
            "v": 13171,
            "t": 2,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "experiment"
            }]
        },
        "7edf4112-8587-453b-a823-b1731e87d601": {
            "name": "chat_replies",
            "v": 14372,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment_a"
            }, {
                "weight": 0,
                "value": "treatment_b"
            }, {
                "weight": 0,
                "value": "treatment_c"
            }]
        },
        "7fa8f4db-6288-4f30-a184-975b1b4aa4ed": {
            "name": "experiments_json_td",
            "v": 6756,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "variant0"
            }, {
                "weight": 50,
                "value": "variant1"
            }]
        },
        "7ff6a29e-5681-45ed-ad66-46d35a9549bc": {
            "name": "Twilight Player Core NPM Distribution (Public)",
            "v": 21129,
            "t": 1,
            "s": 6,
            "groups": [{
                "weight": 0,
                "value": "base"
            }, {
                "weight": 50,
                "value": "variant-a"
            }, {
                "weight": 50,
                "value": "variant-b"
            }]
        },
        "8140d736-e8dd-49bc-b7cb-0d5b65d4cd5b": {
            "name": "mobile_native_chat_filter_existing_users",
            "v": 9186,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "opt-in"
            }]
        },
        "82defd30-1613-4f46-804c-773e15a5b8fa": {
            "name": "mischief_left",
            "v": 7362,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "experiment"
            }]
        },
        "842f8360-8948-42f2-a088-92e266724cc8": {
            "name": "twilight_vp_preview_sharing",
            "v": 3372,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "active"
            }]
        },
        "84768cc8-b1f7-4af2-a258-4e0910c0829c": {
            "name": "stream_summary_notifications_analytics",
            "v": 4992,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "84a5b770-f444-45ab-9a57-5755cdb10072": {
            "name": "twilight_quarterly_streamer_survey_for_affiliates",
            "v": 8149,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "Control"
            }, {
                "weight": 0,
                "value": "Variant"
            }]
        },
        "850dcab9-4649-4786-8ff5-d80481bb4220": {
            "name": "sub_to_skip_ads",
            "v": 13755,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment_v2_targeted"
            }, {
                "weight": 0,
                "value": "treatment_v2"
            }, {
                "weight": 0,
                "value": "treatment_targeted"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "854a8252-d166-437e-b5a9-1c6ad5a9e5d3": {
            "name": "tcstring_cmp_twilight_bid_request_rollout",
            "v": 17888,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "ENABLE_TCSTRING"
            }, {
                "weight": 100,
                "value": "DISABLE_TCSTRING"
            }]
        },
        "85e9962b-d35b-4e56-9839-0603129a2de0": {
            "name": "ABRObserveredBitrates",
            "v": 9649,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "treatment"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "86c90fe5-08b2-4d7a-9a12-6072fbbeebcc": {
            "name": "stream_manager_tutorial",
            "v": 14806,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "883426d8-69c4-4f49-b549-bcc342fb1262": {
            "name": "why_sub_button",
            "v": 10279,
            "t": 2,
            "groups": [{
                "weight": 80,
                "value": "control"
            }, {
                "weight": 5,
                "value": "hover_v1"
            }, {
                "weight": 5,
                "value": "hover_v2"
            }, {
                "weight": 5,
                "value": "hover_v3"
            }, {
                "weight": 5,
                "value": "click_v1"
            }]
        },
        "887f891e-52e3-4ae5-a877-cdeb98cf3b4a": {
            "name": "twilight_prime_gift_bomb",
            "v": 8400,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "treatment"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "88a09b2b-2d20-421f-b2d7-6a10d676f546": {
            "name": "viewer_badge_collection",
            "v": 15693,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "897eb1ee-0748-4af9-8bf6-3bc519c05cdc": {
            "name": "bevdet_system_detection",
            "v": 18083,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "in-exp"
            }, {
                "weight": 0,
                "value": "out-of-exp"
            }]
        },
        "89d11f7e-b0e6-4dc0-8d94-fab479045040": {
            "name": "unified_checkout",
            "v": 9538,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "8a892711-cc75-421e-a665-7e13c799d1f2": {
            "name": "spotlight_forced_onboarding",
            "v": 13965,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "8b03036f-2bb1-438d-bc6f-de8cd1ce78de": {
            "name": "experiments_json_t",
            "v": 6760,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "variant0"
            }, {
                "weight": 50,
                "value": "variant1"
            }]
        },
        "8b2a8d0b-a7b0-451a-a343-3eeb60e13a8d": {
            "name": "setlist_v2",
            "v": 19564,
            "t": 2,
            "groups": [{
                "weight": 10,
                "value": "active-alt"
            }, {
                "weight": 90,
                "value": "active"
            }]
        },
        "8c4717a6-9090-4c4b-8fd3-2f167c797680": {
            "name": "AMV2_PHASE2_RELEASE",
            "v": 16406,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "ON"
            }, {
                "weight": 0,
                "value": "OFF"
            }]
        },
        "8c49935d-21cd-49a7-b0f8-d514068a5351": {
            "name": "upcoming_schedules_directory_page",
            "v": 21039,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "active"
            }, {
                "weight": 0,
                "value": "control"
            }, {
                "weight": 50,
                "value": "active_alt"
            }]
        },
        "8ceaf4eb-cd17-494e-8359-a1e75c61d421": {
            "name": "studio_import",
            "v": 17496,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "8d337116-de08-49af-8240-b4429ad044a5": {
            "name": "creatorhome_test",
            "v": 16247,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "8e177f68-71cc-491c-96f5-35e25db2b61d": {
            "name": "twilight_native_login",
            "v": 4351,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "8e25c5be-b20f-44c3-834f-62c447c627aa": {
            "name": "leftnav_affinity_sorted_follows",
            "v": 13367,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "8f9c7141-c19a-4b23-a302-34face0fc467": {
            "name": "testing_tcp2",
            "v": 20674,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "903a2a71-3cc6-489a-9f8a-3804624aeec2": {
            "name": "watch_suggest_username",
            "v": 8438,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "90c60e63-f179-4892-8c23-4585e3105750": {
            "name": "emote_card",
            "v": 8654,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "90d76f4d-7740-4388-8bfe-fc3e8f4dc4c3": {
            "name": "prime_gaming_cta_text_experiment_fgwp",
            "v": 13510,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "get_game"
            }, {
                "weight": 0,
                "value": "claim_game"
            }]
        },
        "921a6d36-7e97-4908-9b29-e4198fa3e34d": {
            "name": "ad_libs",
            "v": 5940,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "A"
            }, {
                "weight": 0,
                "value": "B"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "92e71f71-8c36-4c11-9496-42f4f4dc9bac": {
            "name": "TWILIGHT_AAX_DISPLAY_APAC",
            "v": 16056,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "GAM"
            }, {
                "weight": 100,
                "value": "AAX"
            }]
        },
        "93404bb5-eb2b-4568-803b-e77ce64cac81": {
            "name": "ads_moat",
            "v": 8515,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "enabled"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "9452d9e2-6588-408c-b8aa-1e54ff1e2f4a": {
            "name": "twilight_expando_featuro",
            "v": 2526,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "expanded"
            }]
        },
        "95372c71-56bc-4d6a-8d5d-d4885a7aadf9": {
            "name": "creatorhome_new_affiliate_cluster",
            "v": 19533,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "variant"
            }]
        },
        "95511ae5-b5ef-4638-9bb5-9074c4f3def4": {
            "name": "wysiwyg_chat_input",
            "v": 18113,
            "t": 1,
            "groups": [{
                "weight": 5,
                "value": "control"
            }, {
                "weight": 95,
                "value": "treatment"
            }]
        },
        "96771625-1381-489b-ac51-1cc43c50d67d": {
            "name": "hype_train_approaching_2",
            "v": 16395,
            "t": 3,
            "s": 2,
            "groups": [{
                "weight": 0,
                "value": "Control"
            }, {
                "weight": 100,
                "value": "Experiment"
            }]
        },
        "97354a27-2799-4195-9d86-7f75acefee52": {
            "name": "clean_aa_motivation_wg_fresh_thirty_day_streams_card",
            "v": 21065,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "variant"
            }]
        },
        "974c2972-971c-4296-bd3c-5230c3757755": {
            "name": "ad_moat_s2s",
            "v": 6867,
            "t": 1,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "treatment"
            }]
        },
        "97a8c1d3-f5ca-4b06-9664-1d8a3469a37d": {
            "name": "support_panel",
            "v": 16269,
            "t": 2,
            "s": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }, {
                "weight": 100,
                "value": "treatment_w_gift_option_redesign"
            }]
        },
        "98268c27-df2b-42e9-bf41-01cc64564f6d": {
            "name": "leftnav_li_similarity",
            "v": 11710,
            "t": 2,
            "s": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }]
        },
        "9937cd2a-f6aa-46bb-ac07-ff689eccf51f": {
            "name": "prowse_lo_intelshelf",
            "v": 8893,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "994869b7-223b-4d34-b30c-46b403d6468b": {
            "name": "chat_history",
            "v": 13188,
            "t": 2,
            "s": 1,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "treatment"
            }]
        },
        "99c425d5-7d9f-47bd-a13a-409903cd6515": {
            "name": "SIGNUP_REDIRECT",
            "v": 2033,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "games"
            }, {
                "weight": 0,
                "value": "popular"
            }, {
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "search"
            }]
        },
        "9b438522-a2c8-465c-aa03-c3d4bacf5509": {
            "name": "community-gifting-recommendation-v2.8",
            "v": 21092,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control_2_6"
            }, {
                "weight": 0,
                "value": "variant_2_8"
            }, {
                "weight": 0,
                "value": "holdout_v1"
            }]
        },
        "9c0ac7b2-66b0-4980-9bee-42e07c9202c3": {
            "name": "pinned_chat",
            "v": 21088,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "moderator"
            }, {
                "weight": 0,
                "value": "paid"
            }]
        },
        "9d3df813-9a03-4663-aacd-9b121abbda14": {
            "name": "show_support_subscribe_button",
            "v": 12852,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant_a"
            }, {
                "weight": 0,
                "value": "variant_b"
            }]
        },
        "9ef43141-fe9c-42b9-8566-9ce8f8fd8d65": {
            "name": "prioritize_paypal_eu",
            "v": 10733,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "9f4dd7bf-2df6-4c26-834f-58b153f61329": {
            "name": "bits_new_user_cheer_v1.1",
            "v": 7692,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "off"
            }]
        },
        "9f896da5-16c8-4ec3-b4b7-99168faa5d55": {
            "name": "disco_sprig_logged_in",
            "v": 20266,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "9fced2f8-37c0-447d-a599-726af6a355ff": {
            "name": "stream_display_ads_to_the_edge",
            "v": 16737,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "9fd5885d-28c6-48b6-9ca8-10150cce0eba": {
            "name": "kneafsey-test",
            "v": 18370,
            "t": 1,
            "groups": [{
                "weight": 10,
                "value": "test1"
            }, {
                "weight": 100,
                "value": "test2"
            }]
        },
        "a08f8d09-7890-4eae-914f-6b272d05d1aa": {
            "name": "prioritized_APM_icons",
            "v": 11669,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "experiment"
            }]
        },
        "a1027ba0-4ad5-46e6-9b3f-78301e61b4bf": {
            "name": "reduced_chatters_list",
            "v": 19147,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "in-exp"
            }, {
                "weight": 100,
                "value": "out-exp"
            }]
        },
        "a141e25d-9b8b-49e8-8502-89fcf4803514": {
            "name": "TWILIGHT_AAX_DISPLAY_HEADLINER_M1",
            "v": 16233,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "GAM"
            }, {
                "weight": 100,
                "value": "AAX"
            }]
        },
        "a1fa14d1-a9bd-40a0-83df-c5b6767d5a28": {
            "name": "vx_left_nav_creator_color",
            "v": 14235,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "a22564bf-1fa7-49ef-b2a2-e45ed1d88f30": {
            "name": "extension_overlay_improvement",
            "v": 10791,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "active"
            }]
        },
        "a2779fdd-31f2-4860-bd0f-da42ea301aa6": {
            "name": "prime_subscription_migration",
            "v": 20417,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "a358cd32-1c7d-47b3-bb5a-ae578394732e": {
            "name": "prioritized_signals_card",
            "v": 15760,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "prioritized_signals"
            }]
        },
        "a3d5361e-7a95-439a-b227-739a9d071a9e": {
            "name": "motivation_wg_fresh_thirty_day_streams_card",
            "v": 20723,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "a51bc8be-9cad-477b-b084-83931bb04413": {
            "name": "ad_countdown_timers_surestream",
            "v": 6237,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "test"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "a55dd577-ea7e-4e74-9978-2aa997e59603": {
            "name": "eu_direct_debit",
            "v": 14981,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "t1"
            }, {
                "weight": 1000,
                "value": "c"
            }, {
                "weight": 0,
                "value": "t2"
            }]
        },
        "a5870914-ca72-48a8-b03d-829f6bac16be": {
            "name": "left_nav_few_follows",
            "v": 14187,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }]
        },
        "a5a06042-3edd-400b-bb49-c06beb3480a0": {
            "name": "creator_defined_benefits",
            "v": 12057,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "blurb_only"
            }, {
                "weight": 0,
                "value": "benefits_only"
            }, {
                "weight": 0,
                "value": "blurb_and_benefits"
            }]
        },
        "a83efadb-c417-47e2-9431-921b6116cc0e": {
            "name": "use_rare_candy_vip",
            "v": 13926,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "yes"
            }, {
                "weight": 100,
                "value": "no"
            }]
        },
        "a8ab54c0-499a-4d8c-95f7-82a6f4ce868d": {
            "name": "pay_mambo",
            "v": 5888,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "on"
            }, {
                "weight": 100,
                "value": "off"
            }]
        },
        "a9445a37-d1b7-45ee-9ea4-2d8da493bfb9": {
            "name": "ad_affiliate_rev_share",
            "v": 8316,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "a9667563-723a-4cf7-b253-674d9eef0a53": {
            "name": "twilight_web_onboarding_user",
            "v": 2506,
            "t": 2,
            "groups": [{
                "weight": 1,
                "value": "control"
            }, {
                "weight": 99,
                "value": "no_skip"
            }, {
                "weight": 0,
                "value": "skip"
            }]
        },
        "aa9470fc-3394-418e-9f17-8cd22e07f922": {
            "name": "disco_csv3_context",
            "v": 18387,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "aac9596e-8816-4261-b96c-617b27afe0fc": {
            "name": "twilight_subs_async_checkout",
            "v": 5477,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "async_checkout"
            }]
        },
        "aaf39c7b-2893-47fe-86a2-53f177b3d3b1": {
            "name": "motivation_wg_live_viewer_feedback",
            "v": 20949,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "ab902512-d0da-4bdd-938e-94c30a4d8953": {
            "name": "web_player_parallel_hls",
            "v": 12294,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "ad048640-8726-433a-b822-69e30b8faa77": {
            "name": "liverecs_holdout_device",
            "v": 8980,
            "t": 1,
            "groups": [{
                "weight": 2,
                "value": "holdout"
            }, {
                "weight": 98,
                "value": "control"
            }]
        },
        "ae266243-0248-4e57-b207-0ad86b2d42ad": {
            "name": "gifting_themed_user_notice",
            "v": 16984,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "experiment"
            }, {
                "weight": 0,
                "value": "SKUonly"
            }]
        },
        "ae553f59-0a6e-4263-a637-871e7df7c5f4": {
            "name": "promotions_holdout_device_id",
            "v": 10477,
            "t": 1,
            "groups": [{
                "weight": 97,
                "value": "control"
            }, {
                "weight": 3,
                "value": "holdout"
            }]
        },
        "aeb24e23-67f8-4937-b0fb-57ba9ae2dcf2": {
            "name": "leftnav_lo_similarity_isolated",
            "v": 13090,
            "t": 1,
            "groups": [{
                "weight": 1,
                "value": "control"
            }, {
                "weight": 99,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }]
        },
        "af3153dc-5bdf-474e-8bb4-3f15f9f4c70c": {
            "name": "ad_countdown_timers",
            "v": 6233,
            "t": 1,
            "groups": [{
                "weight": 25,
                "value": "test"
            }, {
                "weight": 75,
                "value": "control"
            }]
        },
        "afc307f3-4011-40ba-9406-56c474b5922b": {
            "name": "twilight_video_featuro_en",
            "v": 2528,
            "t": 1,
            "groups": [{
                "weight": 98,
                "value": "control"
            }, {
                "weight": 1,
                "value": "mixed"
            }, {
                "weight": 1,
                "value": "last"
            }]
        },
        "b1237c9f-015f-41da-800b-222ecd01b52d": {
            "name": "kr_jp_cta_buttons",
            "v": 13588,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "b1567f40-9748-42e3-a65b-1b81c90068b1": {
            "name": "TWILIGHT_CAROUSEL_HOLDBACK",
            "v": 6390,
            "t": 1,
            "groups": [{
                "weight": 99,
                "value": "control"
            }, {
                "weight": 1,
                "value": "experiment"
            }]
        },
        "b235449a-b882-4266-b968-0fc591fba387": {
            "name": "gift_chat_command",
            "v": 19381,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "active"
            }]
        },
        "b24e5cd6-c649-4cab-b768-03ad6cf488be": {
            "name": "TWILIGHT_EXTENDED_PRESENCE",
            "v": 3361,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant_a"
            }]
        },
        "b3650d47-6574-4303-8f11-ee817a5ea1b3": {
            "name": "fpgo",
            "v": 13937,
            "t": 2,
            "s": 2,
            "groups": [{
                "weight": 25,
                "value": "control"
            }, {
                "weight": 975,
                "value": "variant"
            }, {
                "weight": 0,
                "value": "community_gift_subscribe_button"
            }]
        },
        "b40df9a0-9dcd-4946-b364-830b7693d2dd": {
            "name": "avs_checkout",
            "v": 12013,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "experiment"
            }, {
                "weight": 0,
                "value": "control"
            }]
        },
        "b465cff0-db85-49d4-ba60-e23e9e87ddaf": {
            "name": "cecg_vod_tool_prod",
            "v": 20772,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "b513457d-752d-4e41-9aae-aeaedd8280e4": {
            "name": "default_emotes_for_new_affiliates",
            "v": 20454,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "b76b82ac-d5cf-4845-a96f-5243c22856bd": {
            "name": "sub_modal_variant",
            "v": 6573,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "scroll"
            }, {
                "weight": 50,
                "value": "accordion"
            }]
        },
        "b79bf6b6-72e8-4efd-9555-3827fce2634c": {
            "name": "vader_snooze_to_cancel",
            "v": 14582,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "ON"
            }, {
                "weight": 0,
                "value": "OFF"
            }, {
                "weight": 100,
                "value": "657058953"
            }]
        },
        "b7e96e85-7f92-47f5-824e-d7a64b26eb92": {
            "name": "cheering2.0_midnight_squid_deprecated",
            "v": 19766,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "Control"
            }, {
                "weight": 0,
                "value": "Experiment"
            }]
        },
        "b885f7db-298e-4128-8e80-260481b5f1a9": {
            "name": "chat_replies_context_preference",
            "v": 14371,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "minimum"
            }, {
                "weight": 100,
                "value": "expanded"
            }]
        },
        "b8c26067-ebc7-4942-8c7d-14beec8a2d85": {
            "name": "vxp_hide_miniplayer",
            "v": 10831,
            "t": 1,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "variant"
            }]
        },
        "bd1b4ced-f031-4733-b5f5-6b9f5ce14777": {
            "name": "community-gifting-recommendation-v2.5",
            "v": 9718,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "new"
            }]
        },
        "bd9234fc-3c40-45f6-a544-868478744ba7": {
            "name": "featured_collection_disable",
            "v": 6184,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "disabled"
            }]
        },
        "bdb5c085-9f43-41f5-ac33-d58b41af2e5c": {
            "name": "TWILIGHT_AAX_DISPLAY_DIRECTORY_M2",
            "v": 16145,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "GAM"
            }, {
                "weight": 100,
                "value": "AAX"
            }]
        },
        "c0cc65fb-a706-4f0c-bac4-d92520780a30": {
            "name": "player_desktop_web_disable_dropped_frame_filter",
            "v": 11008,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "c1eb1f14-62db-4604-bfb5-813e752c9dc5": {
            "name": "bits_landing_page",
            "v": 12922,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "bits_landing_page_new_copy"
            }]
        },
        "c2dd6984-2aa8-4ac4-ba47-0cb1322e8ae9": {
            "name": "TWILIGHT_AAX_DISPLAY_EMEA",
            "v": 16147,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "GAM"
            }, {
                "weight": 100,
                "value": "AAX"
            }]
        },
        "c3a0a0bf-d5d1-4937-b751-05868d2ba3d0": {
            "name": "twilight_prime_gift_bomb_dashboard_device",
            "v": 9536,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "treatment"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "c3d63173-99d9-4a4a-a6a5-dd8836e97a6c": {
            "name": "pg_ou_crown_eligibility",
            "v": 16121,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "off"
            }, {
                "weight": 0,
                "value": "on"
            }]
        },
        "c3d9dad9-2ab1-401a-9c11-d2296fb17083": {
            "name": "aj_test",
            "v": 20229,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }, {
                "weight": 50,
                "value": "whatever"
            }]
        },
        "c6fd0d37-c577-4e5f-a2a7-9d2e1c7c300b": {
            "name": "community-gifting-recommendation-v2.6",
            "v": 12736,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "model_2_6"
            }]
        },
        "c7953540-8b70-496a-b794-f600c414d8ef": {
            "name": "follower_emotes_prompt",
            "v": 18711,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variantA"
            }, {
                "weight": 100,
                "value": "variantB"
            }, {
                "weight": 0,
                "value": "variantC"
            }]
        },
        "c8a5d390-5dcf-427f-bfc9-8ed4a3f3a6a8": {
            "name": "twilight_prime_sonic_claim_redirect",
            "v": 8656,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "caec9374-0f39-48fd-a4ba-dc314fc03707": {
            "name": "disco_simplify_logged_out_channel_page_v2",
            "v": 20903,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "cbf02f73-63ee-4e4d-adce-713b1b351206": {
            "name": "expressions_popular_emotes",
            "v": 20045,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "on"
            }, {
                "weight": 100,
                "value": "off"
            }]
        },
        "cc303f3b-6062-4491-bf3a-7599e676b3ed": {
            "name": "subs_benefit_reminder",
            "v": 10016,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant_a"
            }, {
                "weight": 0,
                "value": "variant_b"
            }]
        },
        "cc339232-6c9f-4a36-b443-09c082651472": {
            "name": "seamless_subscription_upgrades",
            "v": 20299,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "tabs"
            }, {
                "weight": 0,
                "value": "extra_button"
            }]
        },
        "cc5fd3e8-7afb-41e4-ab62-29546e226dc8": {
            "name": "leftnav_lo_similarity",
            "v": 11706,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }]
        },
        "cd6e0530-ee25-4416-9b76-3b4f4cc517ca": {
            "name": "the_sill",
            "v": 20853,
            "t": 2,
            "groups": [{
                "weight": 20,
                "value": "control"
            }, {
                "weight": 80,
                "value": "treatment"
            }]
        },
        "ce577266-68fa-40eb-8c07-5ae30488338f": {
            "name": "vxp_left_nav_hover_logged_in",
            "v": 11418,
            "t": 2,
            "groups": [{
                "weight": 75,
                "value": "control"
            }, {
                "weight": 25,
                "value": "treatment"
            }]
        },
        "cef566dc-5836-4f83-8ca6-12839d08426c": {
            "name": "vx_disco_search_suggestions_v1_logged_in",
            "v": 17276,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }, {
                "weight": 0,
                "value": "variant3"
            }]
        },
        "cf91e619-8d8b-486f-83a3-13db61bfbfaf": {
            "name": "bits_top_nav_explanation ",
            "v": 12127,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "experiment"
            }]
        },
        "cf9e3609-e36e-474e-bb34-8e5e5e7005e7": {
            "name": "community_gifting_recommendations",
            "v": 9373,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "3SkuRecommendation"
            }]
        },
        "d005a5ce-4785-4b60-a383-bf08aee73589": {
            "name": "tv_guide",
            "v": 14680,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "overview_upcoming"
            }, {
                "weight": 0,
                "value": "tab_live_upcoming"
            }]
        },
        "d0542db7-8405-42be-a2b7-eb386bdfe34b": {
            "name": "remind_me_on_channel_search",
            "v": 13336,
            "t": 2,
            "groups": [{
                "weight": 1,
                "value": "variant"
            }, {
                "weight": 1,
                "value": "control"
            }]
        },
        "d07845e7-e953-4d39-afcb-1a973549ded5": {
            "name": "subscriber_recap",
            "v": 19476,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant 1"
            }]
        },
        "d0ae8d83-7bfb-49ac-bdbf-2907cf6ebc08": {
            "name": "bits_poliwag",
            "v": 7317,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "off"
            }, {
                "weight": 0,
                "value": "on"
            }]
        },
        "d15008ba-4869-4c35-aa8d-92c38f709a87": {
            "name": "color_promo_experiment",
            "v": 15860,
            "t": 2,
            "s": 1,
            "groups": [{
                "weight": 100,
                "value": "Control"
            }, {
                "weight": 0,
                "value": "GreenTagVariant"
            }, {
                "weight": 0,
                "value": "RedTagVariant"
            }, {
                "weight": 0,
                "value": "PurpleTagVariant"
            }, {
                "weight": 0,
                "value": "BlueTagVariant"
            }, {
                "weight": 0,
                "value": "NoTagVariant"
            }]
        },
        "d1fe9a0a-e9f2-4450-ac57-4ff2eefa0dcf": {
            "name": "twilight_get_bits_top_nav",
            "v": 4017,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "treatment"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "d2e4a581-40d0-48e2-ba4d-429609ef430d": {
            "name": "creator_features_and_tools_creator_home_upsell",
            "v": 20893,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }]
        },
        "d3f30522-c1ec-4e6a-ba77-da90ad6ed053": {
            "name": "cecg_category_suggestions_prod",
            "v": 20696,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "variant"
            }]
        },
        "d442bdd2-0c83-4bc1-b8ce-abb86c1d5556": {
            "name": "vx_disco_follow_nudge_logged_out",
            "v": 15923,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "one_minute"
            }, {
                "weight": 0,
                "value": "five_minutes"
            }, {
                "weight": 0,
                "value": "ten_minutes"
            }]
        },
        "d44f032c-1c84-4545-ae91-77ff485ef33a": {
            "name": "studio_stinger_transition_ui",
            "v": 17838,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "d4752777-a16a-4128-bcfb-42cbd4a53613": {
            "name": "TWILIGHT_OWL_ROOM_CHEERING",
            "v": 3846,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "off"
            }]
        },
        "d47ef49f-5518-4ea7-89ea-12cbae4a8b1e": {
            "name": "apex_legends_tags",
            "v": 14170,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "avatars"
            }, {
                "weight": 0,
                "value": "callout"
            }, {
                "weight": 0,
                "value": "force"
            }, {
                "weight": 0,
                "value": "avatars_hide"
            }, {
                "weight": 0,
                "value": "avatars_force"
            }, {
                "weight": 0,
                "value": "callout_hide"
            }, {
                "weight": 0,
                "value": "callout_force"
            }, {
                "weight": 0,
                "value": "avatars_lang"
            }]
        },
        "d54399a7-7956-4a20-b46b-47af282d7f66": {
            "name": "twilight_theatre_fullscreen",
            "v": 3316,
            "t": 1,
            "groups": [{
                "weight": 90,
                "value": "control"
            }, {
                "weight": 10,
                "value": "theatre"
            }]
        },
        "d70017a1-a0bf-455b-9d1f-c41def5a8bd3": {
            "name": "k_p",
            "v": 19643,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "d76d85cf-fe5c-46a0-b541-bc01c0487de6": {
            "name": "prime_gaming_crown_offer_prioritization",
            "v": 20127,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "d9a876a6-b481-4dcc-9c19-1d717bc623de": {
            "name": "happening_now_by_user",
            "v": 18684,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "da034a34-736e-4c7f-9576-2113cc7ce211": {
            "name": "v6s_versions",
            "v": 18418,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "treatment"
            }]
        },
        "db024908-d3f7-42a4-ad15-433ab9bf9484": {
            "name": "twilight_stream_summary_use_kite",
            "v": 10335,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "db9207c9-e299-4975-8489-d3aea364b8da": {
            "name": "channel_leaderboard",
            "v": 9393,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "subs-rotation"
            }, {
                "weight": 0,
                "value": "subs-tabbed"
            }, {
                "weight": 0,
                "value": "bits-rotation"
            }, {
                "weight": 0,
                "value": "bits-tabbed"
            }]
        },
        "dcb08cfd-cf6c-41d8-9755-477dde483eed": {
            "name": "Devsite_create_apps_form_recaptcha",
            "v": 6021,
            "t": 2,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "variant1"
            }]
        },
        "ddf312f2-bcd5-412c-a64b-86335adee351": {
            "name": "offline_embeds_overlay",
            "v": 16008,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "de013c6f-a800-45ee-9ab4-7965c405e3eb": {
            "name": "TWILIGHT_ARCHER",
            "v": 9036,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "moments"
            }, {
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "moments_with_images"
            }, {
                "weight": 0,
                "value": "balloon"
            }, {
                "weight": 0,
                "value": "inline"
            }]
        },
        "de21a099-8394-4482-bf7a-f2034629e627": {
            "name": "sda_post_fill_drop",
            "v": 16948,
            "t": 1,
            "groups": [{
                "weight": 50,
                "value": "control"
            }, {
                "weight": 50,
                "value": "treatment"
            }]
        },
        "dec8c935-cf8e-48fd-8429-b06001e1a7fb": {
            "name": "xo_benefits",
            "v": 8787,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant_1_no_benefits"
            }, {
                "weight": 0,
                "value": "variant_2_toggle_benefits"
            }]
        },
        "e03cee79-37a8-4e03-af12-87408e85bfac": {
            "name": "bs_to_mafs",
            "v": 17070,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "e0bf6f39-5593-419d-a2ba-55ceb960d358": {
            "name": "picture_by_picture_for_viewers",
            "v": 7471,
            "t": 2,
            "groups": [{
                "weight": 1,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "e1632ecc-ce4e-4bb8-9505-398361ca82e0": {
            "name": "twilight_spade_client_improvements",
            "v": 11506,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "treatment"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "e19f9b03-2c70-4e1b-b33f-3bf73e865f5b": {
            "name": "vxp_leftnav_nocache",
            "v": 11817,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "e33a85a2-43ab-425b-bc2e-555a650b7f2a": {
            "name": "BROADCASTER_AD_REVENUE_ESTIMATE",
            "v": 3259,
            "t": 3,
            "s": 2,
            "groups": [{
                "weight": 10,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "e3f98642-92df-404b-a7eb-21da0473a96b": {
            "name": "kr_jp_string_test",
            "v": 14021,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "e4758fdb-58f0-401c-a3e4-d5cbafd8eae2": {
            "name": "vxp_bottom_banner_v2",
            "v": 17590,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "permanent_banner"
            }, {
                "weight": 0,
                "value": "banner_12"
            }, {
                "weight": 0,
                "value": "banner_12_SN"
            }, {
                "weight": 0,
                "value": "no_banner"
            }]
        },
        "e51fb97f-1dcd-4ba6-8177-81a911b6bf7d": {
            "name": "disco_channel_switcher_logged_in",
            "v": 21091,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "e5c813df-a190-4def-b0cb-932224c989f1": {
            "name": "warp_web_prod",
            "v": 18864,
            "t": 1,
            "groups": [{
                "weight": 990,
                "value": "control"
            }, {
                "weight": 10,
                "value": "treatment"
            }]
        },
        "e7a13ac9-8d55-435f-a238-827032e83b31": {
            "name": "smp_support_panel",
            "v": 16560,
            "t": 2,
            "groups": [{
                "weight": 95,
                "value": "control"
            }, {
                "weight": 5,
                "value": "support_panel"
            }]
        },
        "e85998cd-a7b4-400e-8139-6b1aeab9b4c9": {
            "name": "resizable_chat_column",
            "v": 15324,
            "t": 2,
            "s": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "e993cff0-a27f-4d74-88e8-d67c1486b4ea": {
            "name": "mads_new_path_flag",
            "v": 16639,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "off"
            }]
        },
        "ea3c43f2-6518-4d1e-be39-735013d4718e": {
            "name": "twilight_prime_dismiss_offer",
            "v": 5387,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "off"
            }, {
                "weight": 100,
                "value": "on"
            }]
        },
        "eac76aca-8752-4d5c-88e8-723f4d0598b6": {
            "name": "cecg_vod_tool",
            "v": 20643,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "eb1b8c9b-cd6d-4221-ac97-4d12883921f1": {
            "name": "extensions_dock",
            "v": 7479,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "on"
            }, {
                "weight": 0,
                "value": "off"
            }]
        },
        "ebc2190a-9777-4c4b-9059-c09bf994ac8f": {
            "name": "bits_poliwag",
            "v": 7315,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "off"
            }, {
                "weight": 0,
                "value": "on"
            }]
        },
        "ec640f44-d211-4331-9cee-bc2716b3130e": {
            "name": "mobile_native_chat_filter_new_users",
            "v": 10839,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "opt-out"
            }, {
                "weight": 0,
                "value": "opt-in"
            }]
        },
        "ecee5139-250a-4615-861e-96671259be3a": {
            "name": "prioritize_xsolla",
            "v": 10523,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant"
            }]
        },
        "ed044efc-c119-456a-972d-7ebeebfe8aec": {
            "name": "placement_promotions_pos",
            "v": 10464,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "HP_Variant0"
            }, {
                "weight": 0,
                "value": "HP_Variant1"
            }, {
                "weight": 0,
                "value": "HP_Variant2"
            }, {
                "weight": 0,
                "value": "HP_Variant3"
            }, {
                "weight": 0,
                "value": "LN_Variant0"
            }, {
                "weight": 0,
                "value": "LN_Variant1"
            }, {
                "weight": 0,
                "value": "LN_Variant2"
            }]
        },
        "ed7b8100-d84b-4932-a430-61edb83ee8a5": {
            "name": "TWILIGHT_AAX_DISPLAY_HEADLINER_M2",
            "v": 16146,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "GAM"
            }, {
                "weight": 100,
                "value": "AAX"
            }]
        },
        "ee3b0114-4938-4dfa-82ce-5e36ce690a37": {
            "name": "stream_summary_activity",
            "v": 8642,
            "t": 2,
            "groups": [{
                "weight": 0,
                "value": "yes"
            }, {
                "weight": 100,
                "value": "no"
            }]
        },
        "ee98b960-62c2-43c3-bfbc-4f41b70c5fe5": {
            "name": "ca_track_creator_usage",
            "v": 16665,
            "t": 3,
            "groups": [{
                "weight": 50,
                "value": "group_a"
            }, {
                "weight": 50,
                "value": "group_b"
            }]
        },
        "ef73a98b-b4c7-4566-b8f7-f40f8f3508dc": {
            "name": "personalized_sub_modal_p1",
            "v": 10342,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "ad_free_in_middle"
            }, {
                "weight": 0,
                "value": "ad_free_on_bottom"
            }, {
                "weight": 0,
                "value": "ad_free_only"
            }, {
                "weight": 0,
                "value": "no_benefits_text"
            }, {
                "weight": 0,
                "value": "visual_benefits"
            }]
        },
        "ef8a901e-04b4-45da-8c07-9151191db6ce": {
            "name": "twilight_subs_share_resub",
            "v": 5682,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "no_share"
            }]
        },
        "efaa5444-36e4-4775-8b6d-5ab64f921bbc": {
            "name": "liverecs_holdout_v2",
            "v": 13969,
            "t": 2,
            "groups": [{
                "weight": 2,
                "value": "holdout"
            }, {
                "weight": 98,
                "value": "control"
            }, {
                "weight": 0,
                "value": "graduate"
            }]
        },
        "f027c7e3-e3c1-4ea4-8fad-b7bd1661f90b": {
            "name": "celebi",
            "v": 9358,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "enabled"
            }]
        },
        "f097a48e-5e38-4274-b170-b4f244c72760": {
            "name": "twilight_use_kite",
            "v": 10415,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "f1825646-3eac-4bac-8be3-ab9f736b7dd8": {
            "name": "new_search_backend",
            "v": 5622,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "f37b54f5-4831-4143-b449-63ecb558c297": {
            "name": "LOHP_rec_leftnav",
            "v": 11010,
            "t": 1,
            "s": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "variant1"
            }]
        },
        "f46ef7ca-6acc-43b2-bc77-a41077be06d3": {
            "name": "mse_in_workers",
            "v": 18784,
            "t": 1,
            "groups": [{
                "weight": 86,
                "value": "control"
            }, {
                "weight": 7,
                "value": "treatment"
            }, {
                "weight": 7,
                "value": "holdback"
            }]
        },
        "f4c0f4c8-6fb6-46f9-bb82-2051c2ad49fc": {
            "name": "warp_web_staff",
            "v": 16646,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment"
            }]
        },
        "f4f60d8d-02e1-49fb-acf2-03150ab04fa5": {
            "name": "studio_layer_rotation",
            "v": 19763,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant"
            }]
        },
        "f65ff295-57dd-4ed0-8011-4df783456b56": {
            "name": "fun_captcha_experiment",
            "v": 12909,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "f6dc9c16-cbf2-45b8-a96e-881dc80167f6": {
            "name": "publisher_ext_ids",
            "v": 16548,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "f7249add-1ab5-408a-a019-c854bd7807a6": {
            "name": "subscription_modal_variants",
            "v": 14826,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "multimonth_selector"
            }, {
                "weight": 0,
                "value": "support_panel"
            }, {
                "weight": 0,
                "value": "community_gift_subscribe_button"
            }]
        },
        "f75ab09d-daf7-46db-bdd5-bb5a2f413cf7": {
            "name": "twilight_clips_on_the_brain",
            "v": 4094,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "f7927cc5-60c2-457a-b396-9089c3977d3c": {
            "name": "AF",
            "v": 6255,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "Control"
            }, {
                "weight": 100,
                "value": "Variant"
            }]
        },
        "f79d43af-8d29-4231-8abb-ad1d973a8f61": {
            "name": "fastly-io",
            "v": 7227,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "variant"
            }, {
                "weight": 100,
                "value": "control"
            }]
        },
        "f7c267bf-4333-46e9-bdd8-d64f4804e77f": {
            "name": "sub_modal_2",
            "v": 7793,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 0,
                "value": "modal"
            }, {
                "weight": 0,
                "value": "balloon"
            }, {
                "weight": 0,
                "value": "accordion"
            }, {
                "weight": 0,
                "value": "prime_70_30"
            }, {
                "weight": 0,
                "value": "prime_30_70"
            }, {
                "weight": 100,
                "value": "dirty_modal"
            }]
        },
        "f7d79abf-ba0e-4438-9039-e091cb798e90": {
            "name": "community_insights",
            "v": 12130,
            "t": 3,
            "groups": [{
                "weight": 1,
                "value": "control"
            }, {
                "weight": 99,
                "value": "treatment"
            }]
        },
        "fa443b30-d363-4978-a831-14c653eb6f41": {
            "name": "TWILIGHT_AD_DENSITY_WIDGET",
            "v": 4284,
            "t": 3,
            "s": 1,
            "groups": [{
                "weight": 10,
                "value": "yes"
            }, {
                "weight": 0,
                "value": "no"
            }]
        },
        "fa4ad7ff-6061-4348-8a2e-1775593c7b9d": {
            "name": "vx_vert",
            "v": 12595,
            "t": 1,
            "groups": [{
                "weight": 55,
                "value": "control"
            }, {
                "weight": 15,
                "value": "variant1"
            }, {
                "weight": 15,
                "value": "variant2"
            }, {
                "weight": 15,
                "value": "variant3"
            }]
        },
        "fa56c911-0a8a-49ce-a114-61c95e5ed868": {
            "name": "pvc_web",
            "v": 17161,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "faccc9c6-d6b3-4723-94a3-a2976a73ec9e": {
            "name": "consent_tool_headline",
            "v": 20573,
            "t": 1,
            "groups": [{
                "weight": 16,
                "value": "control"
            }, {
                "weight": 14,
                "value": "A"
            }, {
                "weight": 14,
                "value": "B"
            }, {
                "weight": 14,
                "value": "C"
            }, {
                "weight": 14,
                "value": "D"
            }, {
                "weight": 14,
                "value": "E"
            }, {
                "weight": 14,
                "value": "F"
            }]
        },
        "fb1f9e8f-b689-4c3d-9f8d-5aa055e53dc5": {
            "name": "community-gifting-recommendation-v2.5",
            "v": 10321,
            "t": 3,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "new"
            }]
        },
        "fb46a20b-d002-47f6-8c0e-4bb785c6ffa4": {
            "name": "community-gifting-recommendation-v2.7",
            "v": 17205,
            "t": 2,
            "s": 6,
            "groups": [{
                "weight": 100,
                "value": "control_2_6"
            }, {
                "weight": 0,
                "value": "holdout_v1"
            }, {
                "weight": 0,
                "value": "lower_cache"
            }, {
                "weight": 0,
                "value": "online_boost"
            }, {
                "weight": 0,
                "value": "boost_and_cache"
            }]
        },
        "fba332ae-a178-4b73-8aed-cbc84418e83f": {
            "name": "com30_ocss",
            "v": 19463,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant1"
            }]
        },
        "fba9e195-1661-42c2-85f5-64320965273e": {
            "name": "subs_pif",
            "v": 12817,
            "t": 2,
            "s": 2,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 25,
                "value": "gift_first"
            }, {
                "weight": 25,
                "value": "thank_first"
            }, {
                "weight": 0,
                "value": "use_ml"
            }]
        },
        "fbebba18-e17d-4bb0-b586-0b1f10673bc7": {
            "name": "CIP_RELEASE",
            "v": 16915,
            "t": 3,
            "groups": [{
                "weight": 0,
                "value": "ON"
            }, {
                "weight": 100,
                "value": "OFF"
            }]
        },
        "fc1c53d9-b666-41f7-bdbc-90fa2fdbb8f4": {
            "name": "SawmillStaff",
            "v": 20946,
            "t": 1,
            "s": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 100,
                "value": "treatment"
            }]
        },
        "fcf28cfa-fc55-48ee-af5f-7a88b7d9016c": {
            "name": "ht_cta_exp",
            "v": 14055,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "experiment"
            }]
        },
        "fd5a97d3-d366-4cf3-9945-4dbac3ce8875": {
            "name": "navi_getclusters_small_streams_rollout",
            "v": 21033,
            "t": 2,
            "groups": [{
                "weight": 80,
                "value": "control"
            }, {
                "weight": 20,
                "value": "variant"
            }]
        },
        "fd69ae98-8bd8-4c37-adc3-79d16f534ccd": {
            "name": "ad_loudness_real_time",
            "v": 8560,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "control"
            }, {
                "weight": 0,
                "value": "treatment_always_adjust"
            }, {
                "weight": 100,
                "value": "treatment_only_down"
            }]
        },
        "fdb86e26-34d1-48d8-80dd-1dd62575f940": {
            "name": "bits_enabled_extension_recommendation",
            "v": 8458,
            "t": 2,
            "groups": [{
                "weight": 100,
                "value": "t1"
            }]
        },
        "ff7f864e-3f92-4319-8355-030324469d73": {
            "name": "placement_promotions",
            "v": 9466,
            "t": 1,
            "groups": [{
                "weight": 100,
                "value": "control"
            }, {
                "weight": 0,
                "value": "variant0"
            }, {
                "weight": 0,
                "value": "variant1"
            }, {
                "weight": 0,
                "value": "variant2"
            }, {
                "weight": 0,
                "value": "variant3"
            }]
        },
        "fff85c38-ca37-42c8-961e-024a0e63cb1b": {
            "name": "settings_overlay_indicator",
            "v": 14511,
            "t": 1,
            "groups": [{
                "weight": 0,
                "value": "treatment"
            }, {
                "weight": 100,
                "value": "control"
            }]
        }
    }
}`
]

export default code