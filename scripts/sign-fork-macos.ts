import * as NodePath from "node:path";
import { sign as signApplication } from "@electron/osx-sign";

/** Sign a personal fork with a persistent certificate so Squirrel can authenticate updates. */
export async function signForkMacApp(app: string): Promise<void> {
  const identity = process.env.T3CODE_FORK_MAC_SIGNING_IDENTITY;
  const keychain = process.env.T3CODE_FORK_MAC_SIGNING_KEYCHAIN;
  if (!identity || !keychain) {
    throw new Error("Fork signing requires an identity and a keychain.");
  }
  await signApplication({
    app,
    identity,
    keychain,
    platform: "darwin",
    identityValidation: false,
    preAutoEntitlements: false,
    preEmbedProvisioningProfile: false,
    batchCodesignCalls: true,
    optionsForFile: () => ({
      timestamp: "none",
      entitlements: [
        "com.apple.security.cs.allow-jit",
        "com.apple.security.cs.allow-unsigned-executable-memory",
        "com.apple.security.cs.disable-library-validation",
      ],
    }),
  });
}

/** Sign after packing, before electron-builder creates the DMG and update ZIP. */
export default async function signForkMacAfterPack(context: {
  appOutDir: string;
  packager: { appInfo: { productFilename: string } };
}): Promise<void> {
  await signForkMacApp(
    NodePath.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`),
  );
}
