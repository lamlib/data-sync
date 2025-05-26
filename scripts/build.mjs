import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['./src/main.js'],
  bundle: true,
  banner: {
    js: `
/*!
 * ============================================================
 *  Project:   datasync.js
 *  Version:   1.0.0
 *  Homepage:  https://github.com/lamlib/datasync
 *
 *  Description:
 *    Datasync giúp bạn xử lý đồng bộ dữ liệu giữa máy chủ và client.
 *
 *  Author:    Nhat Han <lamlib2023@gmail.com>
 *  License:   MIT License
 *  Copyright: © 2025 Nhat Han
 *
 *  Created:   2025-05-26
 * ============================================================
 */`,
  },
  outdir: 'dist',
  format: 'iife',
  globalName: 'DataSync',
  minify: true,
})