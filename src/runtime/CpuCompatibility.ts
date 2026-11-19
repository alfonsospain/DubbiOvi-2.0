import os from 'os';
import { spawnSync } from 'child_process';

/**
 * CPU feature detection and runtime variant resolution service.
 * Determines whether the host CPU supports AVX2, FMA, and F16C vector extensions,
 * or requires the universal baseline x86-64 runtime to prevent illegal-instruction crashes.
 */
export class CpuCompatibility {
  private static cachedVariant: 'optimized' | 'baseline' | null = null;

  /**
   * Checks whether the current host platform and architecture is Windows x64.
   */
  public static isWindowsX64(platform = process.platform, arch = process.arch): boolean {
    return platform === 'win32' && (arch === 'x64' || arch === 'ia32');
  }

  /**
   * Known legacy CPU microarchitecture families confirmed to lack AVX2 support.
   * Includes:
   * - Intel Core 2 Duo / Quad / Extreme (Conroe, Penryn, Yorkfield)
   * - Intel Celeron / Pentium / Atom lines (many lack AVX and AVX2)
   * - Intel Core 1st Gen (Nehalem / Westmere e.g. i5-750, i7-920)
   * - Intel Core 2nd Gen (Sandy Bridge e.g. i3-2100, i5-2400, i7-2600 — AVX1 only)
   * - Intel Core 3rd Gen (Ivy Bridge e.g. i3-3220, i5-3470, i7-3770 — AVX1/F16C only, no AVX2)
   * - AMD Athlon, Phenom, Sempron, Turion, FX series (Bulldozer/Piledriver/Steamroller)
   * - AMD A-Series APUs (A4, A6, A8, A10 prior to Carrizo/Excavator)
   */
  private static readonly LEGACY_CPU_PATTERNS: RegExp[] = [
    /\b(pentium|celeron|atom)\b/i,
    /\bcore\(tm\)\s*2\b/i,
    /\bi[357]-\s*\d{3}\b/i,          // 1st Gen: i5-750, i7-920, etc.
    /\bi[357]-\s*2\d{3}\w*\b/i,      // 2nd Gen Sandy Bridge: i5-2400, etc.
    /\bi[357]-\s*3\d{3}\w*\b/i,      // 3rd Gen Ivy Bridge: i7-3770, etc.
    /\b(athlon|phenom|sempron|turion)\b/i,
    /\bfx-\d{4}\b/i,                 // AMD FX-8350, FX-6300, etc.
    /\b(a4|a6|a8|a10)-\d{4}\b/i,     // AMD pre-Carrizo APUs
  ];

  /**
   * Modern CPU families confirmed to support AVX2, FMA, and F16C.
   */
  private static readonly CONFIRMED_AVX2_PATTERNS: RegExp[] = [
    /\bi[3579]-\s*(4|5|6|7|8|9|1[0-9])\d{3}\w*\b/i, // Haswell 4xxx through 14xxx+
    /\bcore\(tm\)\s*ultra\b/i,
    /\b(ryzen|threadripper|epyc)\b/i,
    /\bxeon\(r\)\s+(e[357]-v[3-9]|bronze|silver|gold|platinum|w-)\b/i,
  ];

  /**
   * Queries the Windows OS kernel directly via Win32 API IsProcessorFeaturePresent.
   * Constant 40 = PF_AVX2_INSTRUCTIONS_AVAILABLE.
   * Returns true if Windows kernel and CPU both confirm AVX2 support;
   * false if explicitly unsupported;
   * or null if query failed or unavailable.
   */
  public static queryWindowsAvx2Support(): boolean | null {
    if (process.platform !== 'win32') {
      return null;
    }

    try {
      const psCmd = `Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern bool IsProcessorFeaturePresent(int f);' -Name 'K' -Namespace 'W'; [W.K]::IsProcessorFeaturePresent(40)`;
      const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
        encoding: 'utf8',
        timeout: 2000,
        windowsHide: true,
      });

      if (res.status === 0 && res.stdout) {
        const out = res.stdout.trim().toLowerCase();
        if (out === 'true') return true;
        if (out === 'false') return false;
      }
    } catch (_) {
      // In case PowerShell invocation fails or is restricted, return null to fall back safely
    }

    return null;
  }

  /**
   * Evaluates CPU model string and hardware capability flags to decide whether
   * the host can safely execute the AVX2 Optimized runtime, or must use Baseline.
   *
   * @param modelString Optional CPU brand string (defaults to os.cpus()[0]?.model)
   * @param osProbeResult Optional OS probe result (defaults to undefined)
   * @returns 'optimized' | 'baseline'
   */
  public static evaluateCpuFeatures(
    modelString?: string,
    osProbeResult?: boolean | null
  ): 'optimized' | 'baseline' {
    // Non-Windows systems don't have this dual-runtime requirement
    if (!CpuCompatibility.isWindowsX64()) {
      return 'optimized';
    }

    const cleanModel = (modelString || (os.cpus && os.cpus()[0] ? os.cpus()[0].model : '')).trim();

    // 1. Direct hardware probe result from OS kernel
    if (osProbeResult === false) {
      return 'baseline';
    }

    if (osProbeResult === true) {
      // Sanity check: Ensure probe didn't misreport on known legacy chip (e.g. in emulators)
      for (const pattern of CpuCompatibility.LEGACY_CPU_PATTERNS) {
        if (pattern.test(cleanModel)) {
          return 'baseline';
        }
      }
      return 'optimized';
    }

    // 2. Fallback when OS probe is unavailable: inspect model string with fail-closed bias
    if (cleanModel) {
      // If matches known legacy blacklist -> guaranteed baseline
      for (const pattern of CpuCompatibility.LEGACY_CPU_PATTERNS) {
        if (pattern.test(cleanModel)) {
          return 'baseline';
        }
      }

      // If matches confirmed modern AVX2 whitelist -> optimized
      for (const pattern of CpuCompatibility.CONFIRMED_AVX2_PATTERNS) {
        if (pattern.test(cleanModel)) {
          return 'optimized';
        }
      }
    }

    // 3. Fail-Closed Default: If compatibility cannot be verified reliably, select Baseline
    return 'baseline';
  }

  /**
   * Resolves the target Whisper runtime variant for the host machine.
   * Results are cached in-memory for the duration of the process.
   */
  public static resolveWindowsWhisperVariant(options?: {
    forceProbe?: boolean;
    cachedPreference?: string;
  }): 'optimized' | 'baseline' {
    if (!CpuCompatibility.isWindowsX64()) {
      return 'optimized';
    }

    // Use cached preference if explicitly provided and valid
    if (options?.cachedPreference === 'optimized' || options?.cachedPreference === 'baseline') {
      return options.cachedPreference;
    }

    if (CpuCompatibility.cachedVariant && !options?.forceProbe) {
      return CpuCompatibility.cachedVariant;
    }

    const probe = CpuCompatibility.queryWindowsAvx2Support();
    const model = os.cpus && os.cpus()[0] ? os.cpus()[0].model : '';
    const resolved = CpuCompatibility.evaluateCpuFeatures(model, probe);

    CpuCompatibility.cachedVariant = resolved;
    return resolved;
  }

  /**
   * Clears in-memory cached variant (useful for testing).
   */
  public static clearCache(): void {
    CpuCompatibility.cachedVariant = null;
  }
}
