import { b5r } from "dropin-recipes"
import { KiwiBundleHandlers } from "../.bundles/kiwi-bundle/handlers"
import archiver from "archiver"
// import http from "http"
import { join } from "path"
import { KiwiBundleStage } from "../.bundles/kiwi-bundle/stage"
import { createWriteStream, readFileSync } from "fs"
import crypto from "crypto"
import { K8s } from "../core/k8s"

export default b5r.create<KiwiBundleHandlers>({

  start: ({ options }) => {
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
    })
  },

  deploy: ({ options, stage, path, outputDir, packageJson, name }) => {
    if(Object.keys(options.functions.stages).indexOf(stage) === -1) {
      console.error(`Unknown stage "${stage}"`)
      process.exit(1)
    }

    const currentStage: KiwiBundleStage = options.functions.stages[stage]
    const k8s = new K8s()

    const filename = join(path, "functions.zip")
    const output = createWriteStream(filename)

    const archive = archiver("zip")
    archive.directory(join(path, outputDir), "")
    // archive.file(join(path, "package.json"), { name: "package.json" })
    // archive.file(join(path, "yarn.lock"), { name: "yarn.lock" })
    archive.pipe(output)
    archive.finalize()

    output.on("close", () => {
      const service = `${options.functions.name}-${stage}`

      // Archive
      const file = readFileSync(filename)
      const sha = crypto.createHash("sha256")
      sha.update(file)
      const checksum = `sha256:${sha.digest("hex")}`
      const content = file.toString("base64")

      // Deps
      const deps: any = { name: packageJson.name, version: packageJson.version, dependencies: {} }
      if(typeof packageJson.dependencies !== "undefined") deps.dependencies = packageJson.dependencies
      if(typeof packageJson.peerDependencies !== "undefined") deps.peerDependencies = packageJson.peerDependencies

      // Functions & Ingress
      if(typeof name !== "undefined") {
        if(Object.values(options.functions.paths).indexOf(name) !== -1) {
          k8s.deployFunction(currentStage, service, name, content, checksum, deps)
        } else {
          console.error(`Unknown function "${service}-${name}"`)
          process.exit(1)
        }
      } else {
        const cache = [] as string[]
        (Object.values(options.functions.paths) as string[]).forEach((currentName: string) => {
          if(cache.indexOf(currentName) === -1) {
            k8s.deployFunction(currentStage, service, currentName, content, checksum, deps)
            cache.push(currentName)
          }
        })
        k8s.deployIngress(currentStage, service, options.functions.paths)
      }
    })
  },

  undeploy: ({ options, stage, name }) => {
    if(Object.keys(options.functions.stages).indexOf(stage) === -1) {
      console.error(`Unknown stage "${stage}"`)
      process.exit(1)
    }

    const currentStage: KiwiBundleStage = options.functions.stages[stage]
    const service = `${options.functions.name}-${stage}`

    const k8s = new K8s()

    if(typeof name !== "undefined") {
      if(Object.values(options.functions.paths).indexOf(name) !== -1) {
        k8s.undeployFunction(currentStage, service, name)
      } else {
        console.error(`Unknown function "${service}-${name}"`)
        process.exit(1)
      }
    } else {
      const cache = [] as string[]
      (Object.values(options.functions.paths) as string[]).forEach(currentName => {
        if(cache.indexOf(currentName) === -1) {
          k8s.undeployFunction(currentStage, service, currentName)
          cache.push(currentName)
        }
      })
      k8s.undeployIngress(currentStage, service)
    }
  },

})
