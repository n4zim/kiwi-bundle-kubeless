"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dropin_recipes_1 = require("dropin-recipes");
var archiver_1 = __importDefault(require("archiver"));
var path_1 = require("path");
var fs_1 = require("fs");
var crypto_1 = __importDefault(require("crypto"));
var k8s_1 = require("../core/k8s");
exports.default = dropin_recipes_1.b5r.create({
    start: function (_a) {
        var options = _a.options;
        require("kubeless-runtime")({
            moduleName: options.functions.name,
            requestMbLimit: 1,
            function: {
                handler: "index",
                timeout: 180,
                port: 8080,
                runtime: "nodejs13",
                memoryLimit: "",
            }
        });
    },
    deploy: function (_a) {
        var options = _a.options, stage = _a.stage, path = _a.path, outputDir = _a.outputDir, packageJson = _a.packageJson, name = _a.name;
        if (Object.keys(options.functions.stages).indexOf(stage) === -1) {
            console.error("Unknown stage \"" + stage + "\"");
            process.exit(1);
        }
        var currentStage = options.functions.stages[stage];
        var k8s = new k8s_1.K8s();
        var filename = path_1.join(path, "functions.zip");
        var output = fs_1.createWriteStream(filename);
        var archive = archiver_1.default("zip");
        archive.directory(path_1.join(path, outputDir), "");
        archive.pipe(output);
        archive.finalize();
        output.on("close", function () {
            var service = options.functions.name + "-" + stage;
            var file = fs_1.readFileSync(filename);
            var sha = crypto_1.default.createHash("sha256");
            sha.update(file);
            var checksum = "sha256:" + sha.digest("hex");
            var content = file.toString("base64");
            var deps = { name: packageJson.name, version: packageJson.version, dependencies: {} };
            if (typeof packageJson.dependencies !== "undefined")
                deps.dependencies = packageJson.dependencies;
            if (typeof packageJson.peerDependencies !== "undefined")
                deps.peerDependencies = packageJson.peerDependencies;
            if (typeof name !== "undefined") {
                if (Object.values(options.functions.paths).indexOf(name) !== -1) {
                    k8s.deployFunction(currentStage, service, name, content, checksum, deps);
                }
                else {
                    console.error("Unknown function \"" + service + "-" + name + "\"");
                    process.exit(1);
                }
            }
            else {
                var cache_1 = [];
                Object.values(options.functions.paths).forEach(function (currentName) {
                    if (cache_1.indexOf(currentName) === -1) {
                        k8s.deployFunction(currentStage, service, currentName, content, checksum, deps);
                        cache_1.push(currentName);
                    }
                });
                k8s.deployIngress(currentStage, service, options.functions.paths);
            }
        });
    },
    undeploy: function (_a) {
        var options = _a.options, stage = _a.stage, name = _a.name;
        if (Object.keys(options.functions.stages).indexOf(stage) === -1) {
            console.error("Unknown stage \"" + stage + "\"");
            process.exit(1);
        }
        var currentStage = options.functions.stages[stage];
        var service = options.functions.name + "-" + stage;
        var k8s = new k8s_1.K8s();
        if (typeof name !== "undefined") {
            if (Object.values(options.functions.paths).indexOf(name) !== -1) {
                k8s.undeployFunction(currentStage, service, name);
            }
            else {
                console.error("Unknown function \"" + service + "-" + name + "\"");
                process.exit(1);
            }
        }
        else {
            var cache_2 = [];
            Object.values(options.functions.paths).forEach(function (currentName) {
                if (cache_2.indexOf(currentName) === -1) {
                    k8s.undeployFunction(currentStage, service, currentName);
                    cache_2.push(currentName);
                }
            });
            k8s.undeployIngress(currentStage, service);
        }
    },
});
