module.exports = {
  projectname: "SYworkwechat",
  appid: "YOUR_APP_ID", // 与project.config.json保持一致
  setting: {
    urlCheck: true,
    preloadBackgroundData: false,
    newFeature: false,
    coverView: true,
    nodeModules: false,
    autoAudits: false,
    showShadowRootInWxmlPanel: true,
    scopeDataCheck: false,
    checkInvalidKey: true,
    checkSiteMap: true,
    compileHotReLoad: false,
    useMultiFrameRuntime: true,
    useApiHook: true,
    enableEngineNative: false,
    bundle: false,
    useIsolateContext: true,
    useCompilerModule: true,
    userConfirmedUseCompilerModuleSwitch: false,
    userConfirmedBundleSwitch: false,
    useCompilerPlugins: false, // 从project.config.json同步
    compileWorklet: false, // 从project.config.json同步
    localPlugins: false, // 从project.config.json同步
    disableUseStrict: false, // 从project.config.json同步
    condition: false, // 从project.config.json同步
    swc: false, // 从project.config.json同步
    disableSWC: true // 从project.config.json同步
  },
  compileType: "miniprogram",
  libVersion: "3.10.2", // 与project.config.json保持一致
  srcMiniprogramRoot: "./",
  packOptions: {
    ignore: [],
    include: []
  },
  editorSetting: {} // 清空editorSetting，由project.config.json统一管理
}