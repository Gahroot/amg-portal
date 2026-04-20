/**
 * Expo config plugin — injects native SSL cert pinning for AMG Portal.
 *
 *   - Android: writes `app/src/main/res/xml/network_security_config.xml`
 *     with a `<pin-set>` per host and points the app's
 *     `<application android:networkSecurityConfig>` at it.
 *   - iOS: writes `NSAppTransportSecurity > NSPinnedDomains` into
 *     Info.plist with `NSPinnedLeafIdentities` SPKI-SHA256-BASE64 entries.
 *
 * Pins are read from `expo.extra.certPins` in `app.json`. Each host gets a
 * primary (current leaf) and backup (next renewal leaf) SPKI hash so we
 * can rotate without breaking shipped clients — see
 * `docs/security-runbooks/mobile-cert-pinning.md`.
 *
 * Source patterns:
 *   - Android plugin scaffold:    expo/expo apps/bare-expo/plugins/withAndroidNetworkSecurityConfig.js
 *   - iOS NSPinnedDomains shape:  radarlabs/react-native-radar plugin/src/withRadarIOS.ts
 *   - <pin-set> + expiration:     threema-ch/threema-android, MuntashirAkon/AppManager
 */

const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
} = require('expo/config-plugins');
const fs = require('fs/promises');
const path = require('path');

/**
 * Top-level plugin entry. `app.json` references this via `expo.plugins`.
 *
 * @param {import('@expo/config-types').ExpoConfig} config
 */
const withCertificatePinning = (config) => {
  const pins = readCertPins(config);
  if (!pins || Object.keys(pins).length === 0) {
    // No pins configured (e.g. dev / EAS preview) — skip silently rather
    // than crash the build.
    enforceProductionGuard(pins);
    return config;
  }

  enforceProductionGuard(pins);

  config = withAndroidNetworkSecurityConfigManifest(config);
  config = withAndroidNetworkSecurityConfigXml(config, pins);
  config = withIosPinnedDomains(config, pins);
  return config;
};

/**
 * Hard-fail a production build (`EAS_BUILD_PROFILE=production`) if any
 * configured host carries a placeholder pin. Without this guard a forgotten
 * `REPLACE_WITH_*` would silently disable pinning in production.
 *
 * Skipped in dev / preview profiles so day-to-day work isn't blocked.
 */
function enforceProductionGuard(pins) {
  const profile = process.env.EAS_BUILD_PROFILE || process.env.AMG_BUILD_PROFILE || '';
  if (profile.toLowerCase() !== 'production') return;

  const violations = [];
  if (!pins || Object.keys(pins).length === 0) {
    violations.push('expo.extra.certPins is empty — production builds must pin at least one host');
  } else {
    for (const [host, entry] of Object.entries(pins)) {
      if (!isUsablePin(entry?.primary)) {
        violations.push(`${host}: primary pin is a placeholder (set REPLACE_WITH_… to a real SPKI-SHA256-BASE64)`);
      }
      if (!isUsablePin(entry?.backup)) {
        violations.push(`${host}: backup pin is a placeholder — required for safe rotation`);
      }
    }
  }

  if (violations.length > 0) {
    const msg = [
      'Refusing to build production app with unconfigured certificate pins.',
      'See docs/security-runbooks/mobile-cert-pinning.md.',
      '',
      ...violations.map((v) => `  - ${v}`),
    ].join('\n');
    throw new Error(msg);
  }
}

/**
 * Reads `expo.extra.certPins` from app config. Shape:
 *   {
 *     "api.amg-portal.com": {
 *       "primary": "<base64 SPKI sha256>",
 *       "backup":  "<base64 SPKI sha256>",
 *       "expiration": "2027-01-01"   // optional, Android pin-set expiration
 *     },
 *     ...
 *   }
 */
function readCertPins(config) {
  const extra = config?.extra ?? {};
  return extra.certPins ?? null;
}

const PLACEHOLDER_PATTERN = /^REPLACE_WITH_/i;

function isUsablePin(pin) {
  return typeof pin === 'string' && pin.length > 0 && !PLACEHOLDER_PATTERN.test(pin);
}

const withAndroidNetworkSecurityConfigManifest = (config) =>
  withAndroidManifest(config, async (cfg) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });

const withAndroidNetworkSecurityConfigXml = (config, pins) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectPath = await AndroidConfig.Paths.getProjectPathOrThrowAsync(
        cfg.modRequest.projectRoot,
      );
      const xmlDir = path.join(projectPath, 'app/src/main/res/xml');
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');

      await fs.mkdir(xmlDir, { recursive: true });
      await fs.writeFile(xmlPath, renderAndroidPinXml(pins));
      return cfg;
    },
  ]);

function renderAndroidPinXml(pins) {
  const domainBlocks = Object.entries(pins)
    .map(([host, entry]) => {
      const pinLines = [entry.primary, entry.backup]
        .filter(isUsablePin)
        .map((p) => `      <pin digest="SHA-256">${p}</pin>`)
        .join('\n');

      // pin-set without at least one usable pin is invalid; skip the host.
      if (!pinLines) return '';

      const expirationAttr = entry.expiration
        ? ` expiration="${entry.expiration}"`
        : '';

      return `  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">${escapeXml(host)}</domain>
    <pin-set${expirationAttr}>
${pinLines}
    </pin-set>
  </domain-config>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
${domainBlocks}
</network-security-config>
`;
}

const withIosPinnedDomains = (config, pins) =>
  withInfoPlist(config, (cfg) => {
    const pinnedDomains = {};
    for (const [host, entry] of Object.entries(pins)) {
      const identities = [entry.primary, entry.backup]
        .filter(isUsablePin)
        .map((p) => ({ 'SPKI-SHA256-BASE64': p }));

      if (identities.length === 0) continue;

      pinnedDomains[host] = {
        NSIncludesSubdomains: true,
        NSPinnedLeafIdentities: identities,
      };
    }

    if (Object.keys(pinnedDomains).length === 0) return cfg;

    const existingAts =
      (cfg.modResults.NSAppTransportSecurity && typeof cfg.modResults.NSAppTransportSecurity === 'object'
        ? cfg.modResults.NSAppTransportSecurity
        : {}) || {};

    cfg.modResults.NSAppTransportSecurity = {
      ...existingAts,
      NSAllowsArbitraryLoads: false,
      NSPinnedDomains: {
        ...(existingAts.NSPinnedDomains || {}),
        ...pinnedDomains,
      },
    };
    return cfg;
  });

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = withCertificatePinning;
