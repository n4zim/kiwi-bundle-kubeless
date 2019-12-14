
interface KiwiBundleHandlersStart {
  path: string
  outputDir: string
  options: any
}

interface KiwiBundleHandlersDeploy {
  path: string
  outputDir: string
  options: any
  packageJson: any
  stage: string
  name: string
}

interface KiwiBundleHandlersUndeploy {
  path: string
  options: any
  stage: string
  name: string
}

export interface KiwiBundleHandlers {
  start: (params: KiwiBundleHandlersStart) => void
  deploy: (params: KiwiBundleHandlersDeploy) => void
  undeploy: (params: KiwiBundleHandlersUndeploy) => void
}
