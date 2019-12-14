"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var Kubernetes = __importStar(require("@kubernetes/client-node"));
var K8s = (function () {
    function K8s() {
        this.config = new Kubernetes.KubeConfig();
        this.config.loadFromDefault();
        this.api = this.config.makeApiClient(Kubernetes.CustomObjectsApi);
    }
    K8s.prototype.createFunction = function (namespace, body) {
        return this.api.createNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions", body);
    };
    K8s.prototype.listFunctions = function (namespace) {
        return this.api.listNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions");
    };
    K8s.prototype.getFunction = function (namespace, name) {
        return this.api.getNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions", name);
    };
    K8s.prototype.updateFunction = function (namespace, name, body) {
        return this.api.patchNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions", name, body, {
            headers: {
                "Content-Type": "application/merge-patch+json",
            },
        });
    };
    K8s.prototype.deleteFunction = function (namespace, name, options) {
        if (options === void 0) { options = {}; }
        return this.api.deleteNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions", name, options);
    };
    K8s.prototype.deployFunction = function (stage, service, name, content, checksum, deps) {
        var _this = this;
        var fullName = service + "-" + name;
        var body = {
            kind: "Function",
            apiVersion: "kubeless.io/v1beta1",
            metadata: {
                namespace: stage.namespace,
                name: fullName,
            },
            spec: {
                handler: "index." + name,
                runtime: "nodejs13",
                "function-content-type": "base64+zip",
                function: content,
                deps: JSON.stringify(deps),
                checksum: checksum,
            },
        };
        this.getFunction(stage.namespace, fullName).then(function (response) {
            var previous = response.body.spec;
            if (previous.checksum !== checksum && previous.deps !== body.spec.deps) {
                _this.updateFunction(stage.namespace, fullName, body).then(function () {
                    console.log("-> Function \"" + fullName + "\" updated");
                });
            }
            else {
                console.log("-> No changes on function \"" + fullName + "\"");
            }
        }).catch(function (error) {
            if (error.body.code === 404) {
                _this.createFunction(stage.namespace, body).then(function () {
                    console.log("-> Function \"" + fullName + "\" created");
                });
            }
        });
    };
    K8s.prototype.undeployFunction = function (stage, service, name) {
        var fullName = service + "-" + name;
        this.deleteFunction(stage.namespace, fullName).then(function () {
            console.log("-> Function \"" + fullName + "\" deleted");
        }).catch(function (error) {
            if (error.body.code === 404) {
                console.log("-> Function \"" + fullName + "\" does not exist");
            }
        });
    };
    K8s.prototype.createIngress = function (namespace, body) {
        return this.api.createNamespacedCustomObject("extensions", "v1beta1", namespace, "ingresses", body);
    };
    K8s.prototype.getIngress = function (namespace, name) {
        return this.api.getNamespacedCustomObject("extensions", "v1beta1", namespace, "ingresses", name);
    };
    K8s.prototype.updateIngress = function (namespace, name, body) {
        return this.api.patchNamespacedCustomObject("extensions", "v1beta1", namespace, "ingresses", name, body, {
            headers: {
                "Content-Type": "application/merge-patch+json",
            },
        });
    };
    K8s.prototype.deleteIngress = function (namespace, name, options) {
        if (options === void 0) { options = {}; }
        return this.api.deleteNamespacedCustomObject("extensions", "v1beta1", namespace, "ingresses", name, options);
    };
    K8s.prototype.deployIngress = function (stage, service, paths) {
        var _this = this;
        var body = {
            kind: "Ingress",
            apiVersion: "extensions/v1beta1",
            metadata: {
                namespace: stage.namespace,
                name: service,
                annotations: {
                    "nginx.ingress.kubernetes.io/ssl-redirect": "false",
                },
            },
            spec: {
                rules: [
                    {
                        host: stage.hostname,
                        http: {
                            paths: Object.keys(paths).map(function (path) {
                                return {
                                    path: path,
                                    backend: {
                                        serviceName: service + "-" + paths[path],
                                        servicePort: 8080,
                                    },
                                };
                            })
                        },
                    },
                ],
                tls: [
                    { hosts: [stage.hostname], secretName: stage.tls },
                ],
            },
        };
        this.getIngress(stage.namespace, service).then(function (previous) {
            _this.updateIngress(stage.namespace, service, body).then(function (response) {
                if (previous.body.metadata.generation === response.body.metadata.generation) {
                    console.log("-> No changes on Ingress \"" + service + "\"");
                }
                else {
                    console.log("-> Ingress \"" + service + "\" updated");
                }
            });
        }).catch(function (error) {
            if (error.body.code === 404) {
                _this.createIngress(stage.namespace, body).then(function () {
                    console.log("-> Ingress \"" + service + "\" created");
                });
            }
        });
    };
    K8s.prototype.undeployIngress = function (stage, service) {
        this.deleteIngress(stage.namespace, service).then(function () {
            console.log("-> Ingress \"" + service + "\" deleted");
        }).catch(function (error) {
            if (error.body.code === 404) {
                console.log("-> Ingress \"" + service + "\" does not exist");
            }
        });
    };
    return K8s;
}());
exports.K8s = K8s;
