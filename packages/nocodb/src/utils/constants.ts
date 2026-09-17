// `isEE`/`isOnPrem` are read at module-load time across the codebase
// (license gates, billing, feature availability). The default false
// matches the public CE build. Set `NC_IS_EE=1` / `NC_IS_ONPREM=1` in
// the environment to flip them — typically only for the Docker image's
// own EE entrypoint, never via code.
//
// `isCeLocalDev()` gates the security bypasses in `*-controller.ts`
// stubs added for the EE-flavored patched CE UI. Default false keeps
// production paths through the original ACL / tenant filters; set
// `NC_CE_LOCAL_DEV=1` to re-enable the local-dev short-circuits.
export const isEE: boolean = process.env.NC_IS_EE === '1';
export const isOnPrem: boolean = process.env.NC_IS_ONPREM === '1';
export const isCloud: boolean = false;

export function isCeLocalDev(): boolean {
  return process.env.NC_CE_LOCAL_DEV === '1';
}