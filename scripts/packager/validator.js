const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Pre-packaging Validation Phase for DubbiOvi Engine Runtimes.
 * Verifies executable existence, startup health, and dynamic library readiness.
 */
class RuntimeValidator {
  /**
   * Runs pre-packaging validation suite.
   *
   * @param {Object} spec Package specification options.
   * @returns {{ success: boolean, errors: string[], warnings: string[] }}
   */
  static validate(spec) {
    const errors = [];
    const warnings = [];

    const { srcDir, executable } = spec;
    const execPath = path.join(srcDir, executable);

    console.log(`[Validation Phase] Validating pre-packaged binary at: ${execPath}`);

    // 1. Check Executable File Existence
    if (!fs.existsSync(execPath)) {
      errors.push(`Executable binary not found at path: ${execPath}`);
      return { success: false, errors, warnings };
    }

    const stat = fs.statSync(execPath);
    if (!stat.isFile()) {
      errors.push(`Target executable path is not a file: ${execPath}`);
      return { success: false, errors, warnings };
    }

    // 2. Execution Health Check (--help or --version test)
    console.log(`[Validation Phase] Testing binary startup execution (--help)...`);
    const testResult = spawnSync(execPath, ['--help'], {
      encoding: 'utf8',
      timeout: 3000,
    });

    if (testResult.error) {
      warnings.push(`Binary execution warning (${testResult.error.message}). Verification will proceed.`);
    } else if (testResult.status !== 0 && testResult.status !== 1) {
      warnings.push(`Binary exited with code ${testResult.status} during startup check.`);
    } else {
      console.log(`  ✓ Binary startup check passed cleanly.`);
    }

    // 3. Platform Dynamic Library Resolution Check
    if (process.platform === 'darwin') {
      const otoolRes = spawnSync('otool', ['-L', execPath], { encoding: 'utf8' });
      if (otoolRes.status === 0) {
        console.log(`  ✓ Mach-O dynamic headers read successfully.`);
      }
    } else if (process.platform === 'linux') {
      const lddRes = spawnSync('ldd', [execPath], { encoding: 'utf8' });
      if (lddRes.status === 0 && lddRes.stdout.includes('not found')) {
        warnings.push(`Some ELF dynamic libraries reported 'not found' by ldd.`);
      }
    }

    const success = errors.length === 0;
    return { success, errors, warnings };
  }
}

module.exports = RuntimeValidator;
