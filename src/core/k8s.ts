import * as Kubernetes from "@kubernetes/client-node"
import { KiwiBundleStage } from "../.bundles/kiwi-bundle/stage"

export class K8s {
  private config: Kubernetes.KubeConfig
  private api: Kubernetes.CustomObjectsApi

  constructor() {
    this.config = new Kubernetes.KubeConfig()
    this.config.loadFromDefault()
    this.api = this.config.makeApiClient(Kubernetes.CustomObjectsApi)
  }

  private createFunction(namespace: string, body: object) {
    return this.api.createNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions", body)
  }

  private listFunctions(namespace: string) {
    return this.api.listNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions")
  }

  private getFunction(namespace: string, name: string) {
    return this.api.getNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions", name)
  }

  private updateFunction(namespace: string, name: string, body: object) {
    return this.api.patchNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions", name, body, {
      headers: {
        "Content-Type": "application/merge-patch+json",
      },
    })
  }

  private deleteFunction(namespace: string, name: string, options: Kubernetes.V1DeleteOptions = {}) {
    return this.api.deleteNamespacedCustomObject("kubeless.io", "v1beta1", namespace, "functions", name, options)
  }

  deployFunction(stage: KiwiBundleStage, service: string, name: string, content: string, checksum: string, deps: any) {
    const fullName = `${service}-${name}`
    const body = {
      kind: "Function",
      apiVersion: "kubeless.io/v1beta1",
      metadata: {
        namespace: stage.namespace,
        name: fullName,
      },
      spec: {
        handler: `index.${name}`,
        runtime: "nodejs13",
        "function-content-type": "base64+zip",
        function: content,
        deps: JSON.stringify(deps),
        checksum,
      },
    }
    this.getFunction(stage.namespace, fullName).then(response => {
      const previous = (response.body as any).spec
      if(previous.checksum !== checksum && previous.deps !== body.spec.deps) {
        this.updateFunction(stage.namespace, fullName, body).then(() => {
          console.log(`-> Function "${fullName}" updated`)
        })
      } else {
        console.log(`-> No changes on function "${fullName}"`)
      }
    }).catch(error => {
      if(error.body.code === 404) {
        this.createFunction(stage.namespace, body).then(() => {
          console.log(`-> Function "${fullName}" created`)
        })
      }
    })
  }

  undeployFunction(stage: KiwiBundleStage, service: string, name: string) {
    const fullName = `${service}-${name}`
    this.deleteFunction(stage.namespace, fullName).then(() => {
      console.log(`-> Function "${fullName}" deleted`)
    }).catch(error => {
      if(error.body.code === 404) {
        console.log(`-> Function "${fullName}" does not exist`)
      }
    })
  }

  private createIngress(namespace: string, body: object) {
    return this.api.createNamespacedCustomObject("extensions", "v1beta1", namespace, "ingresses", body)
  }

  private getIngress(namespace: string, name: string) {
    return this.api.getNamespacedCustomObject("extensions", "v1beta1", namespace, "ingresses", name)
  }

  private updateIngress(namespace: string, name: string, body: object) {
    return this.api.patchNamespacedCustomObject("extensions", "v1beta1", namespace, "ingresses", name, body, {
      headers: {
        "Content-Type": "application/merge-patch+json",
      },
    })
  }

  private deleteIngress(namespace: string, name: string, options: Kubernetes.V1DeleteOptions = {}) {
    return this.api.deleteNamespacedCustomObject("extensions", "v1beta1", namespace, "ingresses", name, options)
  }

  deployIngress(stage: KiwiBundleStage, service: string, paths: { [path: string]: string }) {
    const body: Kubernetes.ExtensionsV1beta1Ingress = {
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
              paths: Object.keys(paths).map(path => {
                return {
                  path,
                  backend: {
                    serviceName: `${service}-${paths[path]}`,
                    servicePort: 8080 as any,
                  },
                }
              })
            },
          },
        ],
        tls: [
          { hosts: [ stage.hostname ], secretName: stage.tls },
        ],
      },
    }
    this.getIngress(stage.namespace, service).then(previous => {
      this.updateIngress(stage.namespace, service, body).then(response => {
        if((previous.body as any).metadata.generation === (response.body as any).metadata.generation) {
          console.log(`-> No changes on Ingress "${service}"`)
        } else {
          console.log(`-> Ingress "${service}" updated`)
        }
      })
    }).catch(error => {
      if(error.body.code === 404) {
        this.createIngress(stage.namespace, body).then(() => {
          console.log(`-> Ingress "${service}" created`)
        })
      }
    })
  }

  undeployIngress(stage: KiwiBundleStage, service: string) {
    this.deleteIngress(stage.namespace, service).then(() => {
      console.log(`-> Ingress "${service}" deleted`)
    }).catch(error => {
      if(error.body.code === 404) {
        console.log(`-> Ingress "${service}" does not exist`)
      }
    })
  }

}
